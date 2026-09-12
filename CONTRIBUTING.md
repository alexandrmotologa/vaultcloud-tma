# Contributing to VaultCloud TMA

Contributions are welcome. Please read the guidelines below before submitting pull requests.

## Development Workflow

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development servers:
   ```bash
   npm run dev
   ```

4. Run tests before committing:
   ```bash
   npm test
   ```

## Coding Standards

- TypeScript: Keep strict mode enabled without implicit `any` types.
- Cryptography: Do not modify cryptographic primitives or reduce PBKDF2 iteration counts without prior review.
- Documentation: Write commit messages using the Conventional Commits format (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- Keep pull requests focused on a single change or fix.
