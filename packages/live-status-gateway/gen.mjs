import { TypeScriptGenerator } from '@asyncapi/modelina'
import { fromFile, Parser } from '@asyncapi/parser'
import fs from 'fs/promises'

const BANNER =
	'/* eslint-disable */\n/**\n * This file was automatically generated using and @asyncapi/parser @asyncapi/modelina.\n * DO NOT MODIFY IT BY HAND. Instead, modify the source AsyncAPI schema files,\n * and run "yarn generate-schema-types" to regenerate this file.\n */\n'

const renderDescription = ({ renderer, content, item }) => {
	const desc = item.originalInput.description?.trim()

	if (desc) {
		const doc = renderer.renderComments(`${desc || ''}`.trim())
		return `${doc}\n${content}`
	}
	return content
}
/**
 * Preset which adds descriptions
 * Modified from the original, to omit examples
 *
 * @implements {TypeScriptPreset}
 */
const CUSTOM_TS_DESCRIPTION_PRESET = {
	class: {
		self({ renderer, model, content }) {
			return renderDescription({ renderer, content, item: model })
		},
		getter({ renderer, property, content }) {
			return renderDescription({ renderer, content, item: property.property })
		},
	},
	interface: {
		self({ renderer, model, content }) {
			return renderDescription({ renderer, content, item: model })
		},
		property({ renderer, property, content }) {
			return renderDescription({ renderer, content, item: property.property })
		},
	},
	type: {
		self({ renderer, model, content }) {
			return renderDescription({ renderer, content, item: model })
		},
	},
	enum: {
		self({ renderer, model, content }) {
			return renderDescription({ renderer, content, item: model })
		},
	},
}
//# sourceMappingURL=DescriptionPreset.js.map

const generator = new TypeScriptGenerator({
	modelType: 'interface',
	enumType: 'enum',
	mapType: 'record',
	moduleSystem: 'ESM',
	presets: [CUSTOM_TS_DESCRIPTION_PRESET],
})

const parser = new Parser()
const asyncApiDoc = await fromFile(parser, 'api/asyncapi.yaml').parse()
if (!asyncApiDoc.document) {
	console.error('No document was produced from the asyncapi parser')
	console.error(JSON.stringify(asyncApiDoc.diagnostics))

	process.exit(5)
}

const models = await generator.generate(asyncApiDoc.document)
const allModelNames = []
const allmodelContent = []
for (const model of models) {
	// console.log(model.result, model.modelName)
	allModelNames.push(model.modelName)
	allmodelContent.push(model.result)
}

const allModelsString = BANNER + allmodelContent.join('\n\n') + '\n\n' + 'export {' + allModelNames.join(', ') + '};'

await fs.writeFile('src/generated/schema.ts', allModelsString)

console.log('Schema types written to src/generated/schema.ts')
