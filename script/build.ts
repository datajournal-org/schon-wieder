import * as sass from 'sass';
import { readFileSync, writeFileSync } from 'node:fs';
import express from 'express';
import { NodeHtmlMarkdown } from 'node-html-markdown';

process.chdir(import.meta.dirname);

if (process.argv[2] === 'dev') {
	const app = express();
	app.get('/', (req, res) => {
		res.send(build().html);
	});
	app.use(express.static('../docs', {}));
	app.listen(8080, () => {
		console.log('Server started on http://localhost:8080');
	});
} else {
	const { alt, neu, html } = build();
	writeFileSync('../docs/index.html', html, 'utf8');
	//writeFileSync('../docs/alt.md', alt, 'utf8');
	//writeFileSync('../docs/neu.md', neu, 'utf8');
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

				let html = `<span class="switch"${style}><span>${clean(alt)}</span><br><span>${clean(neu)}</span></span>`;
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
