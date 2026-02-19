from pathlib import Path

ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']
suits = ['s','h','d','c']
symbol = {'s':'♠','h':'♥','d':'♦','c':'♣'}
color = {'s':'#111827','c':'#111827','h':'#b91c1c','d':'#b91c1c'}

out = Path('assets/cards')
out.mkdir(parents=True, exist_ok=True)

for r in ranks:
    for s in suits:
        svg = f"""<svg xmlns='http://www.w3.org/2000/svg' width='120' height='168' viewBox='0 0 120 168'>
  <rect x='3' y='3' width='114' height='162' rx='10' fill='white' stroke='#1f2937' stroke-width='3'/>
  <text x='14' y='28' font-size='24' font-family='Arial, sans-serif' fill='{color[s]}'>{r}{symbol[s]}</text>
  <text x='60' y='97' text-anchor='middle' font-size='56' font-family='Arial, sans-serif' fill='{color[s]}'>{symbol[s]}</text>
  <text x='106' y='156' text-anchor='end' font-size='24' font-family='Arial, sans-serif' fill='{color[s]}'>{r}{symbol[s]}</text>
</svg>
"""
        (out / f"{r}{s}.svg").write_text(svg, encoding='utf-8')

print('generated', len(ranks)*len(suits), 'cards')
