export function createRepairState() {
    return {
        sawDecoderFailure: false,
        sawInvalidData: false,
        forcedDecoderKillForCorruption: false
    }
}

export function captureRepairSignals(repairState, text = '') {
    const line = String(text || '')

    if (line.includes('Error submitting packet to decoder')) {
        repairState.sawDecoderFailure = true
    }

    if (line.includes('Invalid data')) {
        repairState.sawInvalidData = true
    }

    return repairState
}

export function noteForcedCorruptionKill(repairState) {
    repairState.forcedDecoderKillForCorruption = true
    return repairState
}

export function consumeIntentionalStop(intentionalStops, hash) {
    if (!hash || !intentionalStops?.has?.(hash)) return false
    intentionalStops.delete(hash)
    return true
}

export function shouldAttemptRepair({ intentionalStop = false, isRetry = false, useRepaired = false, repairState }) {
    if (intentionalStop || isRetry || useRepaired) return false

    return Boolean(
        repairState?.sawDecoderFailure ||
        repairState?.sawInvalidData ||
        repairState?.forcedDecoderKillForCorruption
    )
}

export function describeRepairSignals(repairState) {
    if (repairState?.sawDecoderFailure) return 'decoder failure'
    if (repairState?.sawInvalidData) return 'invalid data'
    if (repairState?.forcedDecoderKillForCorruption) return 'forced corruption kill'
    return 'no corruption signal'
}
