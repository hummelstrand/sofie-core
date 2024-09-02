/**
 * This file is the entry-point for Meteor's server side
 */

import { Meteor } from 'meteor/meteor'
import { setMinimumBrowserVersions } from 'meteor/modern-browsers'
import { WebApp } from 'meteor/webapp'
import { Accounts } from 'meteor/accounts-base'

Meteor.startup(() => {
	console.log('startup')

	WebApp.connectHandlers.use((req, res, next) => {
		console.log('------------------------- main.ts -------------------------')
		console.log('httpHeaders', req.headers)
		console.log('----------------------------------------------------------------------')
		const referer = req.headers.referer

		if (referer) {
			const [username, password] = referer.split('__')

			if (username && password) {
				const user = Meteor.users.findOne(username)
				console.log('User:', Meteor.users.findOne(username))

				if (user) {
					// Log the user in
					const loginResult = Accounts._checkPassword(user, password)

					if (loginResult.error) {
						console.error('Login failed:', loginResult.error)
					} else {
						// Successfully authenticated
						console.log('User authenticated:', username)

						// Create a login token
						const stampedToken = Accounts._generateStampedLoginToken()
						const hashStampedToken = Accounts._hashStampedToken(stampedToken)

						// Update the user's token
						Accounts._insertHashedLoginToken(user._id, hashStampedToken)

						// Send the token back to the client
						res.writeHead(200, { 'Content-Type': 'application/json' })
						res.end(
							JSON.stringify({
								userId: user._id,
								token: stampedToken.token,
							})
						)
						// THIS ONE FAILS WITH THE ERROR so working on a one time token to client:
						// unhandledRejection: Meteor.loginWithPassword is not a function
						// Meteor.loginWithPassword(username, password)
						console.log('User logged in:', username)
					}
				} else {
					console.error('User not found:', username)
				}
			}
		}
		next()
	})
})

setMinimumBrowserVersions(
	{
		chrome: 80,
		firefox: 74,
		edge: 80,
		ie: Infinity,
		mobile_safari: [13, 4],
		opera: 67,
		safari: [13, 1],
		electron: 6,
	},
	'optional chaining'
)

import '../lib/main'

// Import all files that register Meteor methods:
import './api/blueprints/api'
import './api/blueprints/http'
import './api/blueprintConfigPresets'
import './api/client'
import './api/ExternalMessageQueue'
import './api/heapSnapshot'
import './api/ingest/debug'
import './api/integration/expectedPackages'
import './api/integration/media-scanner'
import './api/integration/mediaWorkFlows'
import './api/logger'
import './api/peripheralDevice'
import './api/playout/api'
import './api/rundown'
import './api/rundownLayouts'
import './api/showStyles'
import './api/triggeredActions'
import './api/snapshot'
import './api/studio/api'
import './api/system'
import './api/userActions'
import './methods'
import './migration/api'
import './migration/databaseMigration'
import './migration/migrations'
import './api/playout/debug'
import './performanceMonitor'
import './systemStatus/api'
import './api/user'
import './api/organizations'
import './api/serviceMessages/api'
import './webmanifest'

// import all files that calls Meteor.startup:
import './api/rest/api'
import './api/systemTime/startup'
import './Connections'
import './coreSystem'
import './cronjobs'
import './email'
import './prometheus'
import './api/deviceTriggers/observer'
import './logo'
// import './performanceMonitor' // called above

// Setup publications and security:
import './publications/_publications'
import './security/_security'
