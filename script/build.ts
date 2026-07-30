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
		return {
			alt: convert((pre, alt, neu, post) => `${pre}${clean(alt)}${post}`),
			neu: convert((pre, alt, neu, post) => `${pre}${clean(neu)}${post}`),
			html: convert((pre, alt, neu, post) => {
				let style = '';
				if (alt.startsWith('$')) {
					style = ' style="text-align: left"';
				} else if (neu.endsWith('$')) {
					style = ' style="text-align: right"';
				}

				let html = `<span class="switch"${style}><span>${clean(alt)}</span><span>${clean(neu)}</span></span>`;
				if (pre || post) {
					html = `<nobr>${pre}${html}${post}</nobr>`;
				}

				return html;
			}),
		};

		function clean(text: string): string {
			return text.replace(/^\$+|\$+$/g, '');
		}

		function convert(
			cb: (pre: string, alt: string, neu: string, post: string) => string,
		): string {
			return content.replace(
				/([a-z]*)\[(.*?)\/(.*?)\]([a-z,.]*)/gis,
				(_, pre: string, alt: string, neu: string, post: string) => {
					pre = pre.trim();
					alt = alt.trim();
					neu = neu.trim();
					post = post.trim();
					return cb(pre, alt, neu, post);
				},
			);
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
