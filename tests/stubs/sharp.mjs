// Tests never process real images; any attempt fails loudly instead of silently succeeding.
export default function sharp() { throw new Error("sharp is stubbed in unit tests"); }
