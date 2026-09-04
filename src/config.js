// Game configuration and constants
export const CONFIG = {
  CITY_SIZE: 600,
  BLOCK_SIZE: 90,
  ROAD_WIDTH: 16,
  SIDEWALK_WIDTH: 4,
  
  GRAVITY: -24, // arcade punchy gravity
  
  PLAYER: {
    HEIGHT: 1.8,
    RADIUS: 0.4,
    WALK_SPEED: 13.0,  // Fast brisk run/jog
    RUN_SPEED: 26.0,   // High-speed super sprint
    JUMP_FORCE: 13.0,  // Athletic jump
    MAX_HEALTH: 100,
  },
  
  VEHICLES: {
    SUPER: {
      id: 'super',
      name: 'Ferrari 458 Italia (Суперкар)',
      mass: 1250,
      maxSpeed: 58, // ~210 km/h
      accel: 34,
      brake: 48,
      reverseSpeed: 20,
      steer: 0.68,
      nitro: 1.70,
      color: 0xe60000, // Ferrari Corsa Red
      type: 'super',
      modelUrl: './assets/ferrari.glb'
    },
    MUSCLE: {
      id: 'muscle',
      name: 'Vapid Dominator (Маслкар)',
      mass: 1550,
      maxSpeed: 48, // ~175 km/h
      accel: 28,
      brake: 42,
      reverseSpeed: 16,
      steer: 0.62,
      nitro: 1.75,
      color: 0x1c58c2,
      type: 'muscle'
    },
    OFFROAD: {
      id: 'offroad',
      name: 'Canis Kamacho 4x4 (Внедорожник)',
      mass: 1900,
      maxSpeed: 42, // ~150 km/h
      accel: 24,
      brake: 40,
      reverseSpeed: 15,
      steer: 0.70,
      nitro: 1.55,
      color: 0x3d7037,
      type: 'offroad'
    },
    POLICE: {
      id: 'police',
      name: 'Police Interceptor (Полиция)',
      mass: 1600,
      maxSpeed: 52, // ~190 km/h
      accel: 30,
      brake: 46,
      reverseSpeed: 18,
      steer: 0.65,
      nitro: 1.65,
      color: 0x111111,
      type: 'police'
    }
  }
};
