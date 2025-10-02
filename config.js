// Configuração central de tamanhos (em pixels lógicos) para todas as entidades
// Ajuste aqui para mudar hitbox e escala visual de cada tipo
window.SizesConfig = {
  player: { width: 16, height: 16 },
  enemy: { width: 16, height: 16 },

  // Inimigos especiais
  rain: { width: 20, height: 20 },
  metralha: { width: 48, height: 48 },
  transport: { width: 100, height: 20 },
  encrenca: { width: 100, height: 20 },

  // Outras entidades
  meteor: { width: 5, height: 5 },
  guided: { width: 10, height: 10 },
  star: { width: 64, height: 48 },
  laser: { width: 2, height: 50 },
  engineFlame: { width: 6, height: 6 },

  // Tiro padrão (bem menor agora)
  missile: { width: 4, height: 4 },
  // Tamanhos por nível para Nuclear (mantidos os valores originais)
  nuclearLevels: [20, 18, 14, 10]
};