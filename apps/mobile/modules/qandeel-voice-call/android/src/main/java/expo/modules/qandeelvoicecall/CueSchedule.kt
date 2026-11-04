package expo.modules.qandeelvoicecall

/**
 * S8B-06 CP2 — the rules that decide WHETHER and WHEN a warning cue is asked of the [CuePlayer] (contract D-05-06, A1 §5).
 * Pure: no Android, no clock of its own (the engine passes its monotonic milliseconds), no thread (the engine holds its
 * lock). The iOS engine carries the same rules (`CueSchedule.swift`), tested by the same cases.
 *
 *   - **Once per id.** An id asked for once (now, or at its scheduled time) is REPEATED forever after: a resume, a late
 *     CALL_ENDING or a new schedule never brings it back.
 *   - **Order.** Once a T-1 was asked for, a T-5 is SUPERSEDED (never plays after it).
 *   - **The local trigger.** [schedule] keeps a time for an id that has not fired; a later schedule moves it. [due] hands
 *     back, in time order, every scheduled cue whose time has come, and forgets it.
 *   - **An end** forgets everything that waits ([clear]).
 */
class CueSchedule {
  class Entry(val id: String, val kind: String, val dueAtMs: Long, val forceAfterMs: Long)

  private val scheduled = LinkedHashMap<String, Entry>()
  private val asked = HashSet<String>()
  private var highestRank = 0

  /** Keeps (or moves) [id]'s time. Returns SCHEDULED, REPEATED or SUPERSEDED. */
  fun schedule(id: String, kind: String, dueAtMs: Long, forceAfterMs: Long): String {
    if (id in asked) return "REPEATED"
    if (rank(kind) < highestRank) return "SUPERSEDED"
    scheduled[id] = Entry(id, kind, dueAtMs, forceAfterMs)
    return "SCHEDULED"
  }

  /** Whether [id] may be asked of the player now. Returns null (yes), REPEATED or SUPERSEDED. Forgets its schedule. */
  fun admit(id: String, kind: String): String? {
    if (id in asked) return "REPEATED"
    if (rank(kind) < highestRank) return "SUPERSEDED"
    scheduled.remove(id)
    return null
  }

  /** The player took [id]: it is asked for, for good. */
  fun asked(id: String, kind: String) {
    asked += id
    highestRank = maxOf(highestRank, rank(kind))
  }

  /** Every scheduled cue due at [nowMs], in time order, forgotten from the schedule. */
  fun due(nowMs: Long): List<Entry> {
    if (scheduled.isEmpty()) return emptyList()
    val due = scheduled.values.filter { nowMs >= it.dueAtMs }.sortedBy { it.dueAtMs }
    for (e in due) scheduled.remove(e.id)
    return due
  }

  /** Forgets every waiting cue (the call ended). Returns their ids. */
  fun clear(): List<String> {
    val ids = scheduled.keys.toList()
    scheduled.clear()
    return ids
  }

  val waiting: Int get() = scheduled.size

  private fun rank(kind: String): Int = if (kind == "T1") 2 else 1
}
