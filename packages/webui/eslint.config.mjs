import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'
// import pluginYaml from 'eslint-plugin-yml'
import pluginReact from 'eslint-plugin-react'
import globals from 'globals'

const extendedRules = await generateEslintConfig({
	tsconfigName: 'tsconfig.eslint.json',
	ignores: [
		'public',
		'dist',
		'src/fonts',
		'src/meteor',
		// HACk
		// 'src/client/lib/data/mos/plugin-support.ts',
	],
	disableNodeRules:
})
extendedRules.push(
	{
		settings: {
			react: {
				version: 'detect',
			},
		},
	},
	pluginReact.configs.flat.recommended,
	pluginReact.configs.flat['jsx-runtime'],
	{
		files: ['src/**/*'],
		languageOptions: {
			globals: {
				...globals.browser,
				JSX: true,
			},
		},
		rules: {},
	},
	// extendedRules.push(...pluginYaml.configs['flat/recommended'], {
	// 	files: ['**/*.yaml'],

	// 	rules: {
	// 		'yml/quotes': ['error', { prefer: 'single' }],
	// 		'yml/spaced-comment': ['error'],
	// 		'spaced-comment': ['off'],
	// 	},
	// })
)

export default extendedRules
