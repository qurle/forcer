// clientStorage is a cache only: any failure (quota, unsupported environment) must never block the plugin

export async function load<T>(key: string): Promise<T | undefined> {
	try {
		return (await figma.clientStorage.getAsync(key)) as T | undefined
	} catch (e) {
		console.warn('[forcer] storage read failed', key, e)
		return undefined
	}
}

export async function save(key: string, value: unknown): Promise<void> {
	try {
		await figma.clientStorage.setAsync(key, value)
	} catch (e) {
		console.warn('[forcer] storage write failed', key, e)
	}
}
