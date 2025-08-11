import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

/**
 * LeagueManager v3
 * - Home & Away
 * - Tie-breakers:
 *   1) Points
 *   2) Head-to-head (direct matches between the two teams)
 *   3) Goal difference (overall)
 *   4) Goals for (overall)
 *   5) Goals against (overall) (less is better)
 *   6) Fair play (less disciplinary points is better)
 *
 * Disciplinary points:
 *  - Yellow  = 1
 *  - Red(2 yellows) = 3
 *  - Direct red = 4
 *
 * Note: Matches now record:
 *  homeY, awayY
 *  homeR2, awayR2  (red from two yellows)
 *  homeRdir, awayRdir (direct reds)
 */

export default function LeagueManager() {
  const [step, setStep] = useState(1);
  const [numTeams, setNumTeams] = useState(6);
  const [names, setNames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [form, setForm] = useState({
    home: 0,
    away: 0,
    homeY: 0,
    awayY: 0,
    homeR2: 0,
    awayR2: 0,
    homeRdir: 0,
    awayRdir: 0,
  });

  // load
  useEffect(() => {
    const saved = localStorage.getItem("league_data_v3");
    if (saved) {
      const parsed = JSON.parse(saved);
      setTeams(parsed.teams || []);
      setMatches(parsed.matches || []);
      setStep(parsed.step || 1);
      setNumTeams(parsed.numTeams || 6);
      setNames(parsed.names || []);
    }
  }, []);

  // save
  useEffect(() => {
    localStorage.setItem(
      "league_data_v3",
      JSON.stringify({ teams, matches, step, numTeams, names })
    );
  }, [teams, matches, step, numTeams, names]);

  function startNames() {
    const n = parseInt(numTeams, 10);
    if (!n || n < 2) return alert("ادخل عدد فرق صحيح (>=2)");
    setNames(Array.from({ length: n }, (_, i) => `الفريق ${i + 1}`));
    setStep(2);
  }

  function updateName(idx, val) {
    const copy = [...names];
    copy[idx] = val;
    setNames(copy);
  }

  function generateLeague() {
    const t = names.map((n, i) => ({ id: i, name: n.trim() || `الفريق ${i + 1}` }));
    let order = shuffleArray([...t]);
    const schedule = roundRobin(order);

    let flat = [];
    schedule.forEach((round, r) => {
      round.forEach((pair, m) => {
        if (pair[0] && pair[1]) {
          flat.push({
            id: `${r}-${m}-first`,
            round: r + 1,
            home: pair[0].id,
            away: pair[1].id,
            played: false,
            homeGoals: null,
            awayGoals: null,
            homeY: 0,
            awayY: 0,
            homeR2: 0,
            awayR2: 0,
            homeRdir: 0,
            awayRdir: 0,
          });
        }
      });
    });

    // second leg (return) - swap home/away and increment round
    const secondLeg = flat.map((match) => ({
      ...match,
      id: `${match.id}-second`,
      round: match.round + schedule.length,
      home: match.away,
      away: match.home,
      played: false,
      homeGoals: null,
      awayGoals: null,
      homeY: 0,
      awayY: 0,
      homeR2: 0,
      awayR2: 0,
      homeRdir: 0,
      awayRdir: 0,
    }));

    setTeams(t);
    setMatches([...flat, ...secondLeg]);
    setStep(3);
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function roundRobin(teamsArray) {
    const n = teamsArray.length;
    const isOdd = n % 2 === 1;
    const teamsLocal = isOdd ? [...teamsArray, { id: "bye", name: "BYE" }] : [...teamsArray];
    const rounds = teamsLocal.length - 1;
    const half = teamsLocal.length / 2;
    const order = [...teamsLocal];
    const schedule = [];
    for (let r = 0; r < rounds; r++) {
      const pairs = [];
      for (let i = 0; i < half; i++) {
        const t1 = order[i];
        const t2 = order[order.length - 1 - i];
        if (t1.id !== "bye" && t2.id !== "bye") pairs.push([t1, t2]);
      }
      schedule.push(pairs);
      const fixed = order[0];
      const rest = order.slice(1);
      rest.unshift(rest.pop());
      order.splice(1, rest.length, ...rest);
      order[0] = fixed;
    }
    return schedule;
  }

  function openMatch(match) {
    setSelectedMatch(match);
    setForm({
      home: match.homeGoals ?? 0,
      away: match.awayGoals ?? 0,
      homeY: match.homeY || 0,
      awayY: match.awayY || 0,
      homeR2: match.homeR2 || 0,
      awayR2: match.awayR2 || 0,
      homeRdir: match.homeRdir || 0,
      awayRdir: match.awayRdir || 0,
    });
  }

  function saveMatch() {
    if (!selectedMatch) return;
    const updated = matches.map((m) =>
      m.id === selectedMatch.id
        ? {
            ...m,
            played: true,
            homeGoals: Number(form.home),
            awayGoals: Number(form.away),
            homeY: Number(form.homeY),
            awayY: Number(form.awayY),
            homeR2: Number(form.homeR2),
            awayR2: Number(form.awayR2),
            homeRdir: Number(form.homeRdir),
            awayRdir: Number(form.awayRdir),
          }
        : m
    );
    setMatches(updated);
    setSelectedMatch(null);
  }

  function resetAll() {
    if (!confirm("هل تريد إعادة ضبط كل البيانات؟")) return;
    setStep(1);
    setNames([]);
    setTeams([]);
    setMatches([]);
    setNumTeams(6);
    localStorage.removeItem("league_data_v3");
  }

  // helper: compute disciplinary points for a team's aggregated stats object
  // formula: yellow *1 + redFromTwo *3 + directRed *4
  function disciplinaryPoints(stats) {
    return (stats.y || 0) * 1 + (stats.r2 || 0) * 3 + (stats.rdir || 0) * 4;
  }

  // compute overall table and return sorted list according to tie-breakers
  function computeTable() {
    // initialize map
    const map = {};
    teams.forEach((t) => {
      map[t.id] = {
        id: t.id,
        name: t.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
        // disciplinary accumulators
        y: 0,
        r2: 0,
        rdir: 0,
      };
    });

    // aggregate overall stats
    matches.forEach((m) => {
      if (!m.played) return;
      const h = map[m.home];
      const a = map[m.away];
      if (!h || !a) return;
      h.played++;
      a.played++;
      const hg = Number(m.homeGoals);
      const ag = Number(m.awayGoals);
      h.gf += hg;
      h.ga += ag;
      a.gf += ag;
      a.ga += hg;
      h.y += Number(m.homeY || 0);
      a.y += Number(m.awayY || 0);
      h.r2 += Number(m.homeR2 || 0);
      a.r2 += Number(m.awayR2 || 0);
      h.rdir += Number(m.homeRdir || 0);
      a.rdir += Number(m.awayRdir || 0);
      if (hg > ag) {
        h.wins++;
        a.losses++;
        h.pts += 3;
      } else if (hg < ag) {
        a.wins++;
        h.losses++;
        a.pts += 3;
      } else {
        h.draws++;
        a.draws++;
        h.pts++;
        a.pts++;
      }
    });

    // finalize gd
    Object.values(map).forEach((x) => {
      x.gd = x.gf - x.ga;
      x.disc = disciplinaryPoints(x); // computed disciplinary points for tie-breaker
    });

    const arr = Object.values(map);

    // helper: compute head-to-head between two teams (both matches)
    function headToHeadStats(aId, bId) {
      const statsA = { pts: 0, gf: 0, ga: 0, gd: 0 };
      const statsB = { pts: 0, gf: 0, ga: 0, gd: 0 };
      matches.forEach((m) => {
        if (!m.played) return;
        const h = m.home;
        const a = m.away;
        if ((h === aId && a === bId) || (h === bId && a === aId)) {
          const hg = Number(m.homeGoals);
          const ag = Number(m.awayGoals);
          if (h === aId) {
            statsA.gf += hg;
            statsA.ga += ag;
            statsB.gf += ag;
            statsB.ga += hg;
            if (hg > ag) statsA.pts += 3;
            else if (hg < ag) statsB.pts += 3;
            else {
              statsA.pts++;
              statsB.pts++;
            }
          } else {
            // h === bId, a === aId
            statsA.gf += ag;
            statsA.ga += hg;
            statsB.gf += hg;
            statsB.ga += ag;
            if (ag > hg) statsA.pts += 3;
            else if (ag < hg) statsB.pts += 3;
            else {
              statsA.pts++;
              statsB.pts++;
            }
          }
        }
      });
      statsA.gd = statsA.gf - statsA.ga;
      statsB.gd = statsB.gf - statsB.ga;
      return { [aId]: statsA, [bId]: statsB };
    }

    // comparator applying tie-breakers
    function cmp(a, b) {
      // 1) Points
      if (b.pts !== a.pts) return b.pts - a.pts;

      // 2) Head-to-head (between a and b)
      const h2h = headToHeadStats(a.id, b.id);
      const aH = h2h[a.id];
      const bH = h2h[b.id];
      if (aH && bH) {
        if (bH.pts !== aH.pts) return bH.pts - aH.pts;
        if (bH.gd !== aH.gd) return bH.gd - aH.gd;
        if (bH.gf !== aH.gf) return bH.gf - aH.gf;
      }

      // 3) Overall goal difference
      if (b.gd !== a.gd) return b.gd - a.gd;

      // 4) Overall goals for
      if (b.gf !== a.gf) return b.gf - a.gf;

      // 5) Goals against (less is better)
      if (a.ga !== b.ga) return a.ga - b.ga;

      // 6) Fair play (less disciplinary points is better)
      if (a.disc !== b.disc) return a.disc - b.disc;

      // final fallback: alphabetical by name
      return a.name.localeCompare(b.name);
    }

    arr.sort(cmp);
    return arr;
  }

  const table = computeTable();

  // UI helpers
  function teamNameById(id) {
    return teams.find((t) => t.id === id)?.name || "?";
  }

  return (
    <div className="min-vh-100" style={{ backgroundColor: "#071226" }}>
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4 text-light">
          <h1 className="h4 mb-0">⚽ إدارة دوري - ذهاب وعودة (نظام ترتيب متقدم)</h1>
          <div>
            <button onClick={resetAll} className="btn btn-danger btn-sm">إعادة ضبط</button>
          </div>
        </div>

        {step === 1 && (
          <div className="card p-3 mb-4" style={{ backgroundColor: "#0b2740" }}>
            <div className="mb-2 text-light">ادخل عدد الفرق:</div>
            <div className="d-flex gap-2">
              <input type="number" value={numTeams} min={2} onChange={(e) => setNumTeams(e.target.value)} className="form-control w-auto" />
              <button onClick={startNames} className="btn btn-primary">التالي</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card p-3 mb-4" style={{ backgroundColor: "#0b2740" }}>
            <div className="text-light mb-2">اكتب أسماء الفرق:</div>
            <div className="row g-2 mb-3">
              {names.map((n, i) => (
                <div key={i} className="col-12 col-sm-6">
                  <input value={n} onChange={(e) => updateName(i, e.target.value)} className="form-control" />
                </div>
              ))}
            </div>
            <div>
              <button onClick={generateLeague} className="btn btn-success me-2">انشاء الجدول</button>
              <button onClick={() => setStep(1)} className="btn btn-outline-light">رجوع</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="row g-3">
            {/* Standings */}
            <div className="col-12 col-lg-6">
              <div className="card p-3 mb-3" style={{ backgroundColor: "#0b2740" }}>
                <h5 className="text-light">🏆 جدول الترتيب</h5>
                <div className="table-responsive">
                  <table className="table table-sm table-dark align-middle mb-0 text-nowrap">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>الفريق</th>
                        <th>ل</th>
                        <th>ف</th>
                        <th>ت</th>
                        <th>خ</th>
                        <th>فارق</th>
                        <th>اهداف</th>
                        <th>نقاط</th>
                        <th>انذارات/طرد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((t, idx) => (
                        <tr key={t.id} className={idx === 0 ? "table-success" : idx === 1 ? "table-info" : idx === 2 ? "table-warning" : ""}>
                          <td className="text-center">{idx + 1}</td>
                          <td>{t.name}</td>
                          <td className="text-center">{t.played}</td>
                          <td className="text-center">{t.wins}</td>
                          <td className="text-center">{t.draws}</td>
                          <td className="text-center">{t.losses}</td>
                          <td className="text-center">{t.gd}</td>
                          <td className="text-center">{t.gf}</td>
                          <td className="text-center fw-bold">{t.pts}</td>
                          <td className="text-center">{t.y}/{t.r2 + t.rdir}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-muted small">
                  ملاحظات: ترتيب كسر التعادل — النقاط → المواجهات المباشرة → فرق الأهداف → الأهداف المسجلة → الأهداف المستقبلة الأقل → اللعب النظيف.
                </div>
              </div>
            </div>

            {/* Matches */}
            <div className="col-12 col-lg-6">
              <div className="card p-3 mb-3" style={{ backgroundColor: "#0b2740" }}>
                <h5 className="text-light">📅 قائمة المباريات</h5>
                <div className="row g-2">
                  {matches.map((m) => {
                    const h = teamNameById(m.home);
                    const a = teamNameById(m.away);
                    return (
                      <div key={m.id} className="col-12">
                        <div className="card p-2 d-flex flex-row justify-content-between align-items-center" style={{ backgroundColor: "#071b2e" }}>
                          <div>
                            <span className="badge bg-primary me-2">جولة {m.round}</span>
                            <strong>{h}</strong> vs <strong>{a}</strong>
                          </div>
                          <div className="d-flex gap-2 align-items-center">
                            <div className="small text-muted me-2">{m.played ? `(${m.homeGoals} - ${m.awayGoals})` : ""}</div>
                            <button onClick={() => openMatch(m)} className="btn btn-sm btn-outline-light">
                              {m.played ? "تعديل" : "تسجيل"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {selectedMatch && (
          <div className="modal-backdrop d-flex align-items-center justify-content-center" style={{ position: "fixed", inset: 0 }}>
            <div className="card p-4" style={{ width: 420, backgroundColor: "#062133" }}>
              <h5 className="mb-2 text-light">تسجيل نتيجة</h5>
              <div className="mb-2 text-light">
                <strong>{teamNameById(selectedMatch.home)}</strong> vs <strong>{teamNameById(selectedMatch.away)}</strong>
                <div className="small text-muted">جولة {selectedMatch.round}</div>
              </div>

              {/* Goals */}
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label text-light">أهداف {teamNameById(selectedMatch.home)}</label>
                  <input type="number" className="form-control" value={form.home} onChange={(e) => setForm({ ...form, home: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label text-light">أهداف {teamNameById(selectedMatch.away)}</label>
                  <input type="number" className="form-control" value={form.away} onChange={(e) => setForm({ ...form, away: e.target.value })} />
                </div>
              </div>

              <hr style={{ borderColor: "#123442" }} />

              {/* Disciplinary inputs: Y, R(from 2), R(direct) */}
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label text-light">انذارات {teamNameById(selectedMatch.home)}</label>
                  <input type="number" className="form-control" value={form.homeY} onChange={(e) => setForm({ ...form, homeY: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label text-light">انذارات {teamNameById(selectedMatch.away)}</label>
                  <input type="number" className="form-control" value={form.awayY} onChange={(e) => setForm({ ...form, awayY: e.target.value })} />
                </div>

                <div className="col-6">
                  <label className="form-label text-light">طرد (من إنذارين) {teamNameById(selectedMatch.home)}</label>
                  <input type="number" className="form-control" value={form.homeR2} onChange={(e) => setForm({ ...form, homeR2: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label text-light">طرد (من إنذارين) {teamNameById(selectedMatch.away)}</label>
                  <input type="number" className="form-control" value={form.awayR2} onChange={(e) => setForm({ ...form, awayR2: e.target.value })} />
                </div>

                <div className="col-6">
                  <label className="form-label text-light">طرد مباشر {teamNameById(selectedMatch.home)}</label>
                  <input type="number" className="form-control" value={form.homeRdir} onChange={(e) => setForm({ ...form, homeRdir: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label text-light">طرد مباشر {teamNameById(selectedMatch.away)}</label>
                  <input type="number" className="form-control" value={form.awayRdir} onChange={(e) => setForm({ ...form, awayRdir: e.target.value })} />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button onClick={() => setSelectedMatch(null)} className="btn btn-outline-light">اغلاق</button>
                <button onClick={saveMatch} className="btn btn-success">حفظ</button>
              </div>

              <div className="mt-2 small text-muted">
                ملاحظة: اللعب النظيف لا يخصم نقاط ولكن يستخدم فقط كمعيار عند التعادل.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

