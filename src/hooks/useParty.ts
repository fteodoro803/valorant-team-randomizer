import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import { useEffect, useRef, useState } from "react";
import { NO_PARTY_MESSAGE, newPartyCode, parseToHost, parseToMember, peerIdForCode } from "../lib/party";
import type { MemberMessage, ToHost, ToMember } from "../lib/party";

/**
 * The two ends of a party, built on PeerJS.
 *
 * PeerJS's free public broker only introduces browsers to each other. Once two are
 * connected, every ban and roll goes straight between them, so nothing here is hosted by
 * us. Both ends check everything they receive with `parseToHost` and `parseToMember`.
 *
 * A dead connection (a phone that went to sleep, a lost signal) can look open for a long
 * time, so a friend pings the host every few seconds and the host answers. Each side treats
 * a connection that has gone quiet as closed.
 */

/** How long a new connection may stay silent before we give up on it. */
const JOIN_TIMEOUT_MS = 15_000;

/** How often a friend pings the host, and how often the host looks for quiet connections. */
const HEARTBEAT_MS = 5_000;

/** How long a connection may go without a word before it counts as gone: three missed pings. */
const SILENT_MS = 15_000;

/** How long a member may be quiet before a new device with their name is let in: one missed ping. */
const TAKEOVER_MS = 8_000;

/** How many connections a host will hold at once, joined or not, so strangers can't pile on. */
const MAX_CONNECTIONS = 10;

/** Tries to take a code that another party already holds before giving up. */
const MAX_CODE_TRIES = 5;

export type HostStatus = "idle" | "connecting" | "open" | "error";

interface HostOptions {
  /** A checked message from a connected device. It is up to the host to decide what it means. */
  onMessage: (peerId: string, message: MemberMessage) => void;
  /** An admitted member's connection closed, whether they left the tab, lost signal or went quiet. */
  onLeave: (playerId: string) => void;
}

interface Connection {
  conn: DataConnection;
  /** Null until the host has admitted them to the team. Only admitted devices are sent snapshots. */
  playerId: string | null;
  /** When anything was last heard from them, for noticing a connection that died without closing. */
  lastSeen: number;
}

/**
 * Starts and runs a party from the host's side.
 *
 * `start` picks a code and listens for it on the broker. If another party already has the
 * code it picks again. Connected devices are kept by their peer id until the host admits them.
 */
export function useHostParty(options: HostOptions) {
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<HostStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connections = useRef(new Map<string, Connection>());
  const sweepRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const teardown = () => {
    clearInterval(sweepRef.current);
    const peer = peerRef.current;
    peerRef.current = null;
    // Cleared before destroying, so the closes this causes don't look like members leaving.
    connections.current.clear();
    peer?.destroy();
  };

  const fail = (message: string) => {
    teardown();
    setCode(null);
    setStatus("error");
    setError(message);
  };

  const listen = (partyCode: string, attempt: number) => {
    const peer = new Peer(peerIdForCode(partyCode));
    peerRef.current = peer;
    const current = () => peerRef.current === peer;
    let opened = false;

    peer.on("open", () => {
      if (!current()) return;
      opened = true;
      setCode(partyCode);
      setStatus("open");
      // Every few seconds, let go of members who have gone quiet. They stay on the team as Offline.
      sweepRef.current = setInterval(() => {
        const now = Date.now();
        for (const [id, entry] of connections.current) {
          if (entry.playerId === null || now - entry.lastSeen <= SILENT_MS) continue;
          connections.current.delete(id);
          entry.conn.close();
          optionsRef.current.onLeave(entry.playerId);
        }
      }, HEARTBEAT_MS);
    });

    peer.on("connection", (conn) => {
      if (!current()) return;
      if (connections.current.size >= MAX_CONNECTIONS) {
        conn.on("open", () => conn.close());
        return;
      }
      const entry: Connection = { conn, playerId: null, lastSeen: Date.now() };
      connections.current.set(conn.peer, entry);
      // 1. Someone who connects and never says who they are is dropped.
      setTimeout(() => {
        if (entry.playerId === null && connections.current.get(conn.peer) === entry) {
          connections.current.delete(conn.peer);
          conn.close();
        }
      }, JOIN_TIMEOUT_MS);
      conn.on("data", (raw) => {
        const message = parseToHost(raw);
        if (!message) return;
        entry.lastSeen = Date.now();
        if (message.type === "ping") {
          if (conn.open) conn.send({ type: "pong" } satisfies ToMember);
          return;
        }
        optionsRef.current.onMessage(conn.peer, message);
      });
      const gone = () => {
        if (connections.current.get(conn.peer) !== entry) return;
        connections.current.delete(conn.peer);
        if (entry.playerId !== null) optionsRef.current.onLeave(entry.playerId);
      };
      conn.on("close", gone);
      conn.on("error", gone);
    });

    // The broker connection can drop while the direct ones carry on, so ask for it back (the code stays ours).
    peer.on("disconnected", () => {
      if (current() && !peer.destroyed) setTimeout(() => current() && peer.reconnect(), 3000);
    });

    peer.on("error", (err) => {
      if (!current()) return;
      if (err.type === "unavailable-id" && attempt + 1 < MAX_CODE_TRIES) {
        peer.destroy();
        listen(newPartyCode(), attempt + 1);
      } else if (err.type === "unavailable-id") {
        fail("Couldn't find a free party code. Try again.");
      } else if (!opened) {
        fail("Couldn't reach the service that sets up parties. Check your connection and try again.");
      }
    });
  };

  const start = () => {
    teardown();
    setError(null);
    setStatus("connecting");
    listen(newPartyCode(), 0);
  };

  const stop = () => {
    teardown();
    setCode(null);
    setStatus("idle");
    setError(null);
  };

  // A party can't outlive the page, so leaving it closes the connections.
  useEffect(() => teardown, []);

  const sendTo = (entry: Connection | undefined, message: ToMember) => {
    if (entry?.conn.open) entry.conn.send(message);
  };

  return {
    code,
    status,
    error,
    start,
    stop,
    /** Marks a connected device as a member of the team. Their older connection, if any, is closed. */
    admit(peerId: string, playerId: string) {
      const entry = connections.current.get(peerId);
      if (!entry) return;
      for (const [id, other] of connections.current) {
        if (id !== peerId && other.playerId === playerId) {
          connections.current.delete(id);
          other.conn.close();
        }
      }
      entry.playerId = playerId;
    },
    /** The team member a connected device was admitted as, or null if they haven't been. */
    playerOf: (peerId: string) => connections.current.get(peerId)?.playerId ?? null,
    /** True when a member has missed a ping, so a new device using their name is probably them coming back. */
    isQuiet(playerId: string) {
      const now = Date.now();
      return [...connections.current.values()].some((e) => e.playerId === playerId && now - e.lastSeen > TAKEOVER_MS);
    },
    /**
     * Disconnects a member, for when the host removes them from the team.
     *
     * They are told first, so their device knows it was removed and doesn't rejoin by itself.
     */
    kick(playerId: string) {
      for (const [id, entry] of connections.current) {
        if (entry.playerId === playerId) {
          connections.current.delete(id);
          sendTo(entry, { type: "removed" });
          setTimeout(() => entry.conn.close(), 500);
        }
      }
    },
    send: (peerId: string, message: ToMember) => sendTo(connections.current.get(peerId), message),
    /** Sends to every admitted member. */
    broadcast(message: ToMember) {
      for (const entry of connections.current.values()) if (entry.playerId !== null) sendTo(entry, message);
    },
    /** Disconnects someone who was refused, once the refusal has had time to arrive. */
    drop(peerId: string) {
      const entry = connections.current.get(peerId);
      connections.current.delete(peerId);
      setTimeout(() => entry?.conn.close(), 500);
    },
  };
}

export type MemberStatus = "idle" | "connecting" | "joined" | "error";

/** Where a join is up to, so the page can say more than "joining". */
export type JoinStep = "finding" | "asking";

interface MemberOptions {
  onMessage: (message: Extract<ToMember, { type: "snapshot" }>) => void;
  /** The host ended the party, or the connection went quiet, after the member was in. */
  onEnded: (reason: string) => void;
  /** The host took this member off the team on purpose. */
  onRemoved: () => void;
}

const unreachable =
  "Couldn't reach that party. Check the code, or the network may be blocking direct connections. Switching between Wi-Fi and mobile data often helps.";

/**
 * Joins a party from a member's device.
 *
 * `join` connects to the host and sends who they are. The member counts as in once the
 * host sends its first snapshot, and as refused if the host says no or stays silent.
 * Once in, it pings the host and treats a host that stops answering as gone.
 */
export function useMemberParty(options: MemberOptions) {
  const [status, setStatus] = useState<MemberStatus>("idle");
  const [step, setStep] = useState<JoinStep>("finding");
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const beatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const teardown = () => {
    clearTimeout(timerRef.current);
    clearInterval(beatRef.current);
    const peer = peerRef.current;
    peerRef.current = null;
    connRef.current = null;
    peer?.destroy();
  };

  const join = (code: string, hello: ToHost) => {
    teardown();
    setError(null);
    setStep("finding");
    setStatus("connecting");
    const peer = new Peer();
    peerRef.current = peer;
    const current = () => peerRef.current === peer;
    let joined = false;
    let lastHeard = Date.now();

    const fail = (message: string) => {
      if (!current()) return;
      teardown();
      setStatus("error");
      setError(message);
    };

    timerRef.current = setTimeout(() => fail(unreachable), JOIN_TIMEOUT_MS);

    peer.on("open", () => {
      if (!current()) return;
      const conn = peer.connect(peerIdForCode(code), { reliable: true });
      connRef.current = conn;
      const closed = () => {
        if (!current()) return;
        if (!joined) return fail(unreachable);
        teardown();
        setStatus("idle");
        optionsRef.current.onEnded("The party ended, or your connection to the host dropped.");
      };
      conn.on("open", () => {
        setStep("asking");
        lastHeard = Date.now();
        conn.send(hello);
        beatRef.current = setInterval(() => {
          if (Date.now() - lastHeard > SILENT_MS) return closed();
          if (conn.open) conn.send({ type: "ping" } satisfies ToHost);
        }, HEARTBEAT_MS);
      });
      conn.on("data", (raw) => {
        const message = parseToMember(raw);
        if (!message || !current()) return;
        lastHeard = Date.now();
        if (message.type === "pong") return;
        if (message.type === "removed") {
          teardown();
          setStatus("idle");
          optionsRef.current.onRemoved();
          return;
        }
        if (message.type === "refused") return fail(message.reason);
        if (!joined) {
          joined = true;
          clearTimeout(timerRef.current);
          setStatus("joined");
        }
        optionsRef.current.onMessage(message);
      });
      conn.on("close", closed);
      conn.on("error", closed);
    });

    peer.on("error", (err) => {
      if (!current()) return;
      if (err.type === "peer-unavailable") fail(NO_PARTY_MESSAGE);
      else if (!joined) fail(unreachable);
    });
  };

  const leave = () => {
    teardown();
    setStatus("idle");
    setError(null);
  };

  useEffect(() => teardown, []);

  return {
    status,
    step,
    error,
    join,
    leave,
    send(message: ToHost) {
      if (connRef.current?.open) connRef.current.send(message);
    },
  };
}
