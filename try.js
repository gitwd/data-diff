var dataDiff = require('./')();

console.log(JSON.stringify(
	dataDiff.diff(
		[
			{ date: 1, items: [{ name: '语文', text: '123' }, { name: '数学', text: '321' }] },
			{ date: 1, items: [{ name: '语文', text: 'hello' }, { name: '数学', text: 'yeah' }] }
		],
		[
			{ date: 1, items: [{ name: '语文', text: '123' }, { name: '数学', text: '321' }] },
			{ date: 1, items: [{ name: '语文', text: 'hello' }, { name: '数学', text: 'yeah' }, { name: '化学', text: 'hhh' }] }
		]
	)
))