import express, { type Response } from 'express';
import { watch } from 'node:fs';
import { build, docsDir, templateDir } from './build.js';

const PORT = Number(process.env.PORT ?? 8080);

// Eindeutig pro Prozessstart. Der Browser merkt sich die Kennung beim ersten
// Verbinden und lädt neu, sobald nach einem automatischen Reconnect eine andere
// ankommt. Dadurch wirkt auch ein Neustart durch `tsx watch` ohne Handgriff.
const generation = String(Date.now());

const clients = new Set<Response>();
const app = express();

const reloadScript = `<script>
	(() => {
		let seen = null;
		const source = new EventSource('/__reload');
		source.onmessage = (event) => {
			if (event.data === 'reload') return location.reload();
			// Handschlag: erste Kennung merken, jede abweichende bedeutet Neustart.
			if (seen === null) seen = event.data;
			else if (seen !== event.data) location.reload();
		};
	})();
</script>`;

function escapeHtml(text: string): string {
	return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

// Fehlerseite statt Stacktrace im Terminal. Sie trägt das Reload-Skript mit,
// verschwindet also von selbst, sobald der Fehler behoben ist.
function errorPage(error: unknown): string {
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
	return `<!doctype html>
<meta charset="utf-8" />
<title>Build-Fehler</title>
<style>
	body {
		margin: 0;
		padding: 2rem;
		background: #2b2118;
		color: #f2e7d8;
		font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	h1 {
		margin: 0 0 1.2rem;
		font-size: 0.8rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #ffa657;
	}
	pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
<h1>Build-Fehler</h1>
<pre>${escapeHtml(message)}</pre>
${reloadScript}`;
}

function sendPage(_request: express.Request, response: Response): void {
	response.set('Cache-Control', 'no-store');
	try {
		const { html } = build();
		response.send(html.replace('</body>', `${reloadScript}</body>`));
	} catch (error) {
		console.error(error);
		response.send(errorPage(error));
	}
}

app.get('/', sendPage);
app.get('/index.html', sendPage);

app.get('/__reload', (request, response) => {
	response.set({
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
	});
	response.flushHeaders();
	response.write(`data: ${generation}\n\n`);

	// Kommentarzeilen halten die Verbindung offen, ohne ein Ereignis auszulösen.
	const heartbeat = setInterval(() => response.write(': ping\n\n'), 30_000);
	clients.add(response);
	request.on('close', () => {
		clearInterval(heartbeat);
		clients.delete(response);
	});
});

// Nur Assets — index.html kommt oben aus dem frischen Build, nicht aus docs/.
app.use(express.static(docsDir, { index: false }));

// fs.watch feuert pro Speichervorgang mehrfach (vor allem auf macOS); bündeln.
// Änderungen am Code beobachtet `tsx watch`, das startet stattdessen neu.
let pending: NodeJS.Timeout | undefined;
watch(templateDir, { recursive: true }, () => {
	clearTimeout(pending);
	pending = setTimeout(() => {
		for (const client of clients) client.write('data: reload\n\n');
	}, 50);
});

const server = app.listen(PORT, () => {
	console.log(`Dev-Server auf http://localhost:${PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
	if (error.code !== 'EADDRINUSE') throw error;
	console.error(`Port ${PORT} ist belegt — mit PORT=3000 npm run dev einen anderen wählen.`);
	process.exit(1);
});

// `tsx watch` schickt vor dem Neustart SIGTERM. Offene SSE-Verbindungen zuerst
// schließen, sonst hält der Server den Port und der Neustart scheitert.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
	process.on(signal, () => {
		for (const client of clients) client.end();
		server.close(() => process.exit(0));
	});
}
