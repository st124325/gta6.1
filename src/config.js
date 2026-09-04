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
      accel: 36,
      brake: 52,
      reverseSpeed: 22,
      steer: 0.72,
      grip: 0.20,
      nitro: 1.70,
      color: 0xe60000, // Ferrari Corsa Red
      type: 'super',
      modelUrl: './assets/ferrari.glb'
    },
    MUSCLE: {
      id: 'muscle',
      name: 'Vapid Dominator (Маслкар)',
      mass: 1550,
      maxSpeed: 50, // ~180 km/h
      accel: 30,
      brake: 45,
      reverseSpeed: 18,
      steer: 0.65,
      grip: 0.16,
      nitro: 1.75,
      color: 0x1c58c2,
      type: 'muscle'
    },
    OFFROAD: {
      id: 'offroad',
      name: 'Canis Kamacho 4x4 (Внедорожник)',
      mass: 1900,
      maxSpeed: 44, // ~158 km/h
      accel: 26,
      brake: 42,
      reverseSpeed: 16,
      steer: 0.70,
      grip: 0.18,
      nitro: 1.55,
      color: 0x3d7037,
      type: 'offroad'
    },
    POLICE: {
      id: 'police',
      name: 'Police Interceptor (Полиция)',
      mass: 1600,
      maxSpeed: 54, // ~195 km/h
      accel: 32,
      brake: 48,
      reverseSpeed: 20,
      steer: 0.68,
      grip: 0.19,
      nitro: 1.65,
      color: 0x111111,
      type: 'police'
    }
  }
};
