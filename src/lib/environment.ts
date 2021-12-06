import 'dotenv/config'

const environmentVariables = [
	'NODE_ENV'
] as const
type Env = typeof environmentVariables[ number ]

export const env = {} as Record<Env, string>
for ( const key of environmentVariables ) {
	const value = process.env[ key ]
	if ( !value ) throw new Error( `Missing environment variable: ${ key }` )
	env[ key ] = value
}
