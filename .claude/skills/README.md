# Design skills

Project-level [Agent Skills](https://code.claude.com/docs/en/skills) for design
and front-end work. Claude Code discovers these automatically when working in
this repo — no extra setup needed. Each is also user-invocable (e.g.
`/impeccable`, `/design-taste-frontend`, `/ui-ux-pro-max`).

| Skill | What it does | Source | License |
|-------|--------------|--------|---------|
| `impeccable` | Design, redesign, critique, audit, and polish front-end UI; anti-pattern detection; theming and design tokens. | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0 |
| `design-taste-frontend` | Anti-slop front-end design guidance for landing pages, portfolios, and redesigns — infers a design direction and ships interfaces that don't look templated. | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT |
| `ui-ux-pro-max` | Searchable UI/UX design database — styles, color palettes, font pairings, product types, UX guidelines, and chart types across many stacks. | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT |

Each `SKILL.md` retains its upstream frontmatter (name, description, license,
version). The skills are self-contained — bundled scripts and reference data
live alongside each `SKILL.md`.

## Adding more variants from these repos

The `taste-skill` and `ui-ux-pro-max` repos ship additional companion skills
(e.g. `redesign-existing-projects`, `high-end-visual-design`, `minimalist-ui`,
`industrial-brutalist-ui` from taste-skill; `brand`, `design-system`,
`ui-styling`, `slides`, `banner-design` from ui-ux-pro-max). To add one, copy
its skill directory into `.claude/skills/`, e.g.:

```bash
git clone --depth 1 https://github.com/Leonxlnx/taste-skill /tmp/taste-skill
cp -r /tmp/taste-skill/skills/redesign-skill .claude/skills/redesign-existing-projects
```

## 21st.dev Magic MCP server

The [21st.dev Magic](https://21st.dev/magic) MCP server (a React component
generator) is configured in `../.mcp.json` at the repo root. It needs an API
key from the [Magic Console](https://21st.dev/magic/console).

Claude Code reads the key from the `MAGIC_MCP_API_KEY` environment variable
(the config maps it to the `API_KEY` the server expects). Provide it via:

- **Claude Code on the web:** add `MAGIC_MCP_API_KEY` as an environment variable
  on the environment (Settings → Environment variables).
- **Local Claude Code:** export it in your shell before launching, e.g.
  `export MAGIC_MCP_API_KEY=your-key-here`.

Until a key is set the `magic` server will start but fail to authenticate; the
rest of Claude Code (including the skills above) is unaffected.
