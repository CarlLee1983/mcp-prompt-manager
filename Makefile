.PHONY: start build dev test lint format release clean

start:
	pnpm start

build:
	pnpm build

dev:
	pnpm inspector:dev

test:
	pnpm test:run

lint:
	pnpm lint

format:
	pnpm format

release:
	pnpm release

clean:
	rm -rf dist coverage .prompts_cache
