import * as sass from 'sass';
import { readFileSync, writeFileSync, watch } from 'node:fs';
import express, { type Response } from 'express';
import { NodeHtmlMarkdown } from 'node-html-markdown';

process.chdir(import.meta.dirname);

if (process.argv.includes('dev')) {
	const app = express();
	const reloadClients = new Set<Response>();
	const reloadScript =
		"<script>new EventSource('/__reload').onmessage=()=>location.reload();</script>";

	app.get('/', (_req, res) => {
		const { html } = build();
		res.send(html.replace('</body>', `${reloadScript}</body>`));
	});

	app.get('/__reload', (req, res) => {
		res.set({
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		});
		res.flushHeaders();
		reloadClients.add(res);
		req.on('close', () => reloadClients.delete(res));
	});

	app.use(express.static('../docs', {}));

	// fs.watch fires multiple events per save (esp. on macOS); coalesce them.
	let pending: NodeJS.Timeout | undefined;
	watch('../template', { recursive: true }, () => {
		clearTimeout(pending);
		pending = setTimeout(() => {
			for (const client of reloadClients) client.write('data: reload\n\n');
		}, 50);
	});

	app.listen(8080, () => {
		console.log('Server started on http://localhost:8080');
	});
} else {
	const { alt, neu, html } = build();
	writeFileSync('../docs/index.html', html, 'utf8');

	if (process.argv.includes('alt')) {
		writeFileSync('../docs/alt.md', alt, 'utf8');
		writeFileSync('../docs/neu.md', neu, 'utf8');
	}
}

function build(): { alt: string; neu: string; html: string } {
	let content = readFileSync('../template/de.html', 'utf8');
	let { alt, neu, html } = generateContent(content);

	alt = NodeHtmlMarkdown.translate(alt);
	neu = NodeHtmlMarkdown.translate(neu);

	const style = sass.compile('../template/main.scss', { style: 'expanded' }).css;

	let template = readFileSync('../template/template.html', 'utf8');
	template = blockReplace(template, '<!--content-->', html);
	html = blockReplace(template, '/*style*/', style);
	return { alt, neu, html };

	function generateContent(content: string): { alt: string; neu: string; html: string } {
		const SWITCH = /\[(.*?)\/(.*?)\]/gs;

		return {
			alt: content.replace(SWITCH, (_, alt: string) => clean(alt.trim())),
			neu: content.replace(SWITCH, (_, __, neu: string) => clean(neu.trim())),
			html: buildHtml(),
		};

		function clean(text: string): string {
			return text.replace(/^\$+|\$+$/g, '');
		}

		function buildHtml(): string {
			const spans: string[] = [];

			// Erst Platzhalter einsetzen. Sie enthalten keinen Leerraum, damit die
			// Wortgrenzen des Quelltexts erhalten bleiben.
			const marked = content.replace(SWITCH, (_, alt: string, neu: string) => {
				alt = alt.trim();
				neu = neu.trim();

				let style = '';
				if (alt.startsWith('$')) {
					style = ' style="text-align: left"';
				} else if (neu.endsWith('$')) {
					style = ' style="text-align: right"';
				}

				spans.push(
					`<span class="switch"${style}><span>${clean(alt)}</span><span>${clean(neu)}</span></span>`,
				);
				return `\uE000${spans.length - 1}\uE001`;
			});

			// .switch ist inline-grid und damit ein atomarer Kasten — Browser dürfen
			// unmittelbar davor und dahinter umbrechen. Aus "[Reich/Bunde$]stag" würde
			// sonst "Reich" / "stag". Jedes Wort, das einen Umschalter enthält, kommt
			// deshalb in ein <nobr>: auch bei Ziffern ("3[$7,2/2,8]") und bei zwei
			// Klammern in Folge ("[Lenin/Wagenknecht$]-[$Bund/Bündnis]").
			//
			// Wortgrenze ist Leerraum, eine Tag-Grenze, "&" oder ein Bindestrich.
			// "&" bleibt draußen, damit &shy; eine Trennstelle bleibt. Der Bindestrich
			// wird noch mitgenommen, danach endet der Block — so hängt "Wagenknecht-"
			// zusammen, "Bündnis" darf aber in die nächste Zeile rutschen.
			const glued = marked.replace(/[^\s<>&-]*\uE000\d+\uE001[^\s<>&-]*-?/g, (word) =>
				// Ein allein stehender Umschalter braucht keine Klammer drumherum.
				/^\uE000\d+\uE001$/.test(word) ? word : `<nobr>${word}</nobr>`,
			);

			return glued.replace(/\uE000(\d+)\uE001/g, (_, index: string) => spans[Number(index)]);
		}
	}

	function blockReplace(content: string, find: string, replace: string): string {
		const parts = content.split(find);
		if (parts.length !== 2) throw new Error(`"${find}" must be exactly once in the content`);
		const indent = parts[0].match(/[ \t]*$/)![0];
		replace = replace.replace(/\n/gm, `\n${indent}`);
		return parts.join(replace);
	}
}
