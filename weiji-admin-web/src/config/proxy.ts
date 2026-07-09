const proxy = {
	'/admin': {
		target: 'http://localhost:17801',
		changeOrigin: true
	},

	'/app': {
		target: 'http://localhost:17801',
		changeOrigin: true
	},

	'/dev/': {
		target: 'http://127.0.0.1:17801',
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/dev/, '')
	},

	'/prod/': {
		target: 'https://show.cool-admin.com',
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/prod/, '/api')
	}
};

const value = 'dev';
const host = proxy[`/${value}/`]?.target;

export { proxy, host, value };
