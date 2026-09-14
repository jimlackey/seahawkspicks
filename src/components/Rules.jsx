import { STANDINGS_POINTS } from "../lib/scoring.js";

export default function Rules() {
  return (
    <div className="rules-page">
      <section className="rules-section">
        <h2>How picks work</h2>
        <p>
          Before each Seahawks game kicks off, everyone predicts the final score — a Seahawks score and an
          opponent score. You can change your pick as many times as you want until kickoff; once the game
          starts, it's locked in.
        </p>
      </section>

      <section className="rules-section">
        <h2>Diff: how accuracy is measured</h2>
        <p>
          <strong>Diff</strong> is the total number of points your prediction was off by — the Seahawks score
          error plus the opponent score error.
        </p>
        <div className="rules-example">
          <p className="rules-example-label">Example</p>
          <p>Actual final: Seahawks 24, Opponent 20</p>
          <p>Your pick: Seahawks 21, Opponent 17</p>
          <p className="rules-example-math">
            Diff = |24 − 21| + |20 − 17| = 3 + 3 = <strong>6</strong>
          </p>
        </div>
      </section>

      <section className="rules-section">
        <h2>Weekly ranking: 1st, 2nd, 3rd</h2>
        <p>
          Lowest Diff wins the week — <strong>but only among players who correctly picked which team would
          win.</strong> A low Diff doesn't count for 1st place if you had the wrong team winning outright. If
          nobody picks the correct winner that week, 1st place just goes to the lowest Diff overall.
        </p>
        <p>2nd and 3rd place are simply whoever's left, ordered by Diff.</p>
        <div className="rules-example">
          <p className="rules-example-label">Example — actual final: Seahawks 20, Opponent 24 (Seahawks lost)</p>
          <table className="rules-example-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pick</th>
                <th>Correct winner?</th>
                <th>Diff</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Jim</td>
                <td>22–20</td>
                <td>✗ (picked Hawks to win)</td>
                <td>6</td>
                <td>2nd</td>
              </tr>
              <tr>
                <td>Mark</td>
                <td>16–21</td>
                <td>✓</td>
                <td>7</td>
                <td>🥇 1st</td>
              </tr>
              <tr>
                <td>Brian</td>
                <td>10–30</td>
                <td>✓</td>
                <td>16</td>
                <td>3rd</td>
              </tr>
            </tbody>
          </table>
          <p>
            Jim had the single lowest Diff (6) of anyone — but he picked the Seahawks to win, and they lost.
            That disqualifies him from 1st. Between the two players who correctly called the loss, Mark's Diff
            of 7 is lower than Brian's 16, so <strong>Mark takes 1st</strong>. Jim still beats Brian on Diff, so
            he takes 2nd.
          </p>
        </div>
      </section>

      <section className="rules-section">
        <h2>Missed picks</h2>
        <p>
          If you don't submit a pick before kickoff, you're scored as the <strong>worst Diff among everyone who
          did pick, plus 1</strong> — guaranteeing you can't accidentally beat someone who actually played.
        </p>
        <div className="rules-example">
          <p className="rules-example-label">Example</p>
          <p>Jim's Diff: 6 · Mark's Diff: 7 · Brian didn't submit a pick.</p>
          <p className="rules-example-math">
            Brian's Diff = worst of (6, 7) + 1 = 7 + 1 = <strong>8</strong>
          </p>
        </div>
      </section>

      <section className="rules-section">
        <h2>Season standings</h2>
        <p>Each week's 1st/2nd/3rd finish earns points toward the season total:</p>
        <table className="rules-points-table">
          <tbody>
            <tr>
              <td>🥇 1st place</td>
              <td>{STANDINGS_POINTS[1]} points</td>
            </tr>
            <tr>
              <td>🥈 2nd place</td>
              <td>{STANDINGS_POINTS[2]} point</td>
            </tr>
            <tr>
              <td>🥉 3rd place</td>
              <td>{STANDINGS_POINTS[3]} points</td>
            </tr>
          </tbody>
        </table>
        <p>
          Your season total is just the sum of every week's points. The <strong>Standings</strong> page also
          shows how many times you've finished 1st/2nd/3rd, with the points each of those earned you shown
          alongside.
        </p>
      </section>

      <section className="rules-section">
        <h2>Over/Under (for bragging rights only)</h2>
        <p>
          Once you enter both scores, the app shows your predicted total and whether that lands Over or Under
          the game's total line — computed automatically from your pick, nothing to select. This is
          informational only and <strong>doesn't affect your Diff, your weekly rank, or your standings
          points.</strong>
        </p>
        <div className="rules-example">
          <p className="rules-example-label">Example</p>
          <p>Total line: 44.5</p>
          <p>Your pick: Seahawks 27, Opponent 20 → predicted total 47</p>
          <p className="rules-example-math">
            47 is above 44.5, so this pick shows as <strong>Over</strong>. (An exact tie on a whole-number line
            shows as <strong>Push</strong>.)
          </p>
        </div>
      </section>
    </div>
  );
}
