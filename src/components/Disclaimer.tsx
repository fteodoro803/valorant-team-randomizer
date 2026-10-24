/**
 * The two Riot notices, shown at the foot of every page.
 *
 * Both are worded as Riot gives them and neither is to be reworded.
 */
export function Disclaimer() {
  return (
    <footer className="disclaimer">
      {/* Fan-content notice, fixed by Riot's "Legal Jibber Jabber" policy, section 6 (#5). */}
      <p>
        Valorant Team Randomizer was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot
        Games. Riot Games does not endorse or sponsor this project.
      </p>
      {/* Product notice that Riot's general developer policy requires of every registered product. */}
      <p>
        Valorant Team Randomizer isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or
        anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
        properties are trademarks or registered trademarks of Riot Games, Inc.
      </p>
    </footer>
  );
}
