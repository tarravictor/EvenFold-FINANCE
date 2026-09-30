import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({ plugins: [react()], resolve: { alias: { "@": path.resolve(process.cwd()) } }, base: process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/` : "/", build: { outDir: "pages-dist", emptyOutDir: true } });
