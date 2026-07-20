// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_light_hitman.sql';
import m0001 from './0001_violet_betty_ross.sql';
import m0002 from './0002_damp_giant_girl.sql';
import m0003 from './0003_huge_firebird.sql';
import m0004 from './0004_spooky_supernaut.sql';
import m0005 from './0005_nap_schedule_auto.sql';
import m0006 from './0006_feeding_prefs_locale.sql';
import m0007 from './0007_bath_events.sql';
import m0008 from './0008_daily_chores_temperament.sql';
import m0009 from './0009_chore_recurrence.sql';
import m0010 from './0010_sync_state.sql';
import m0011 from './0011_sleep_insights.sql';
import m0012 from './0012_task_reminders.sql';
import m0013 from './0013_household_name.sql';
import m0014 from './0014_active_baby.sql';
import m0015 from './0015_pending_sync_deletes.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
    m0008,
    m0009,
    m0010,
    m0011,
    m0012,
    m0013,
    m0014,
    m0015,
  },
};
