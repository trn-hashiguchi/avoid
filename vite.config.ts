import { defineConfig } from 'vite';

const base =
  process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/';

export default defineConfig({
  base
});
