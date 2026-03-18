export const WS_EVENTS = {
  // Client → Server
  IDENTITY_SET_NICKNAME: 'identity:set-nickname',
  ROOM_LIST: 'room:list',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_KICK: 'room:kick',
  GAME_ACTION: 'game:action',

  // Server → Client
  IDENTITY_CONFIRMED: 'identity:confirmed',
  ROOM_LIST_UPDATE: 'room:list:update',
  ROOM_UPDATED: 'room:updated',
  ROOM_KICKED: 'room:kicked',
  GAME_STARTED: 'game:started',
  GAME_STATE: 'game:state',
  GAME_PRIVATE: 'game:private',
  GAME_ACTION_REQUIRED: 'game:action-required',
  GAME_ACTION_PERFORMED: 'game:action-performed',
  GAME_SHOWDOWN: 'game:showdown',
  GAME_ENDED: 'game:ended',
  GAME_HAND_STARTED: 'game:hand-started',
  TIMER_TICK: 'timer:tick',
  ERROR: 'error',
} as const;
