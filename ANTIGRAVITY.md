# Antigravity Assistant Guidelines for E-Wallet Project

## General Behavior
- **Commit Regularly:** Always create a git commit after successfully completing a chunk of work, scaffold, or feature integration. Do not wait for the user to ask to commit. Use descriptive conventional commit messages.
- **Consult the PRD:** The `PRD.md` is the single source of truth for all system architecture, API contracts, and database schemas. Always refer to it before implementing backend structures.
- **Adhere to the UI Aesthetic:** The UI has been established with Shadcn UI and modern Tailwind v4 syntax. Ensure any new frontend components match this high-quality, premium aesthetic.

## Tech Stack Rules
- **Backend:** Django 5.0, DRF. Keep business logic tightly encapsulated in `services.py` and async background jobs in `tasks.py`. Use the exact models provided in the PRD.
- **Frontend:** React 18, Vite, Tailwind CSS v4. Ensure all new UI components are placed in `frontend/src/components/` and follow the `.tsx` / `.jsx` patterns established by the initial v0 generation.
