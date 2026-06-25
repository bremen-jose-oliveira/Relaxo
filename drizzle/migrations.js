// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_light_hitman.sql';
import m0001 from './0001_violet_betty_ross.sql';
import m0002 from './0002_damp_giant_girl.sql';
import m0003 from './0003_huge_firebird.sql';
import m0004 from './0004_spooky_supernaut.sql';
import m0005 from './0005_nap_schedule_auto.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  