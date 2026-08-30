# Contributing to Morning Routine Sender

Thank you for your interest in contributing to **Morning Routine Sender**!

---

## 🛠️ Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/sammy-cool/morning-routine-sender.git
   cd morning-routine-sender
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment:**

   ```bash
   cp .env.example .env
   # Update .env with your local database and SMTP credentials
   ```

4. **Run database migrations:**

   ```bash
   npm run db:migrate
   ```

5. **Start development server:**
   ```bash
   npm start
   ```

---

## 🧪 Quality Assurance & Testing Standards

Before opening a pull request or merging changes, ensure all verification checks pass:

```bash
# 1. AST Syntax Check
npm run check:syntax

# 2. Prettier Formatting
npm run format
npm run format:check

# 3. ESLint Code Quality
npm run lint

# 4. Automated Jest Test Suite
npm test
```

---

## 📝 Commit Conventions & Changelog Policy

- We follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` for new features or capabilities
  - `fix:` for bug fixes
  - `docs:` for documentation updates
  - `refactor:` for code refactoring without feature changes
  - `test:` for test additions or updates
  - `chore:` for maintenance or dependency updates
- Whenever you make user-facing or architectural changes, please update [`CHANGELOG.md`](./CHANGELOG.md) under the `[Unreleased]` section.
