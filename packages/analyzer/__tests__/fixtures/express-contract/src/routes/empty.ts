declare const router: { options(path: string): void; get(path: unknown): void }
router.options('/ignored')
router.get(Symbol('dynamic'))
