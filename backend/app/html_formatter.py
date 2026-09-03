"""Convert synthesizer JSON output to HTML for in-browser display."""
from datetime import datetime


_COLORS = {
    "green": {"accent": "#86BC25", "light": "#f0f7e6"},
    "teal": {"accent": "#00A3AD", "light": "#e6f6f7"},
}


def _escape(text: str) -> str:
    return (str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))


def format_briefing(topic_key: str, topic_config: dict, synthesis: dict, start_date: str, end_date: str) -> str:
    color = _COLORS.get(topic_config.get("color", "green"), _COLORS["green"])
    accent = color["accent"]
    light = color["light"]
    label = _escape(topic_config["label"])

    bluf = _escape(synthesis.get("bluf", ""))
    market_signals = synthesis.get("market_signals", [])
    policy_updates = synthesis.get("policy_updates", [])
    federal_actions = synthesis.get("federal_actions", [])
    investment_activity = synthesis.get("investment_activity", [])
    emerging_relationships = synthesis.get("emerging_relationships", [])
    trajectory = _escape(synthesis.get("trajectory", ""))

    def bullet_list(items):
        if not items:
            return "<li><em>No data available for this period.</em></li>"
        return "\n".join(f"<li>{_escape(item)}</li>" for item in items)

    def federal_table(rows):
        if not rows:
            return "<p><em>No federal actions found for this period.</em></p>"
        html = """<table>
<thead><tr>
  <th>Organization</th><th>Amount</th><th>Agency</th><th>Date</th><th>Description</th>
</tr></thead><tbody>"""
        for i, row in enumerate(rows[:5]):
            bg = f'style="background:{light}"' if i % 2 == 0 else ""
            html += f"""<tr {bg}>
  <td><strong>{_escape(row.get('org',''))}</strong></td>
  <td>{_escape(row.get('amount',''))}</td>
  <td>{_escape(row.get('agency',''))}</td>
  <td>{_escape(row.get('date',''))}</td>
  <td>{_escape(row.get('description',''))}</td>
</tr>"""
        html += "</tbody></table>"
        return html

    def relationship_table(rows):
        if not rows:
            return "<p><em>No emerging relationships found for this period.</em></p>"
        signal_colors = {
            "Capital Raise": "#22863a", "M&A": "#6f42c1",
            "Partnership": "#0366d6", "Growth": "#e36209",
        }
        html = """<table>
<thead><tr><th>Company</th><th>Signal</th><th>Detail</th></tr></thead><tbody>"""
        for i, row in enumerate(rows[:6]):
            bg = f'style="background:{light}"' if i % 2 == 0 else ""
            signal = row.get("signal", "")
            sig_color = signal_colors.get(signal, "#666")
            html += f"""<tr {bg}>
  <td><strong>{_escape(row.get('company',''))}</strong></td>
  <td><span style="color:{sig_color};font-weight:600">{_escape(signal)}</span></td>
  <td>{_escape(row.get('detail',''))}</td>
</tr>"""
        html += "</tbody></table>"
        return html

    return f"""<div class="topic-section" style="border-top: 4px solid {accent}; margin-bottom: 2.5rem; padding-top: 1.5rem;">
  <h2 style="color:{accent}">{label}</h2>

  <div class="bluf" style="background:{light}; border-left: 4px solid {accent}; padding: 1rem 1.25rem; margin: 1rem 0 1.5rem; border-radius: 4px;">
    <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;color:{accent};margin-bottom:0.4rem">BOTTOM LINE UP FRONT</div>
    <p style="margin:0;font-style:italic">{bluf}</p>
  </div>

  <h3>Market Signals</h3>
  <ul>{bullet_list(market_signals)}</ul>

  <h3>Policy &amp; Regulatory Updates</h3>
  <ul>{bullet_list(policy_updates)}</ul>

  <h3>Federal Contracting &amp; Funding Actions</h3>
  {federal_table(federal_actions)}

  <h3>Private Investment &amp; Activity</h3>
  <ul>{bullet_list(investment_activity)}</ul>

  <h3>Emerging Relationships</h3>
  {relationship_table(emerging_relationships)}

  <h3>Trajectory &amp; Outlook</h3>
  <p style="font-style:italic">{trajectory}</p>
</div>"""


def wrap_briefing(topic_sections: list[str], topics_covered: list[str], start_date: str, end_date: str) -> str:
    topics_str = _escape(", ".join(topics_covered))
    generated = _escape(datetime.today().strftime("%B %d, %Y"))
    content = "\n".join(topic_sections)

    return f"""<div class="briefing-doc">
  <div class="briefing-header">
    <h1>Federal Health AI Market Intelligence Brief</h1>
    <div class="briefing-meta">Report Period: {_escape(start_date)} &mdash; {_escape(end_date)}</div>
    <div class="briefing-meta">Coverage: {topics_str}</div>
    <div class="briefing-meta">Generated: {generated}</div>
  </div>
  {content}
  <div class="briefing-footer">
    <strong>Sources:</strong> USASpending.gov &bull; SAM.gov &bull; Federal Register &bull; NIH Reporter &bull; Google News RSS &bull; ClinicalTrials.gov<br>
    <em>For internal distribution only &bull; Based on publicly available information</em>
  </div>
</div>"""
