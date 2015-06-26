#ifndef TIRO_H
#define TIRO_H

#include <stdint.h>

int random(int Maximo);

void ProcessaJogo();
void Caixa(int x, int y, int largura, int altura, uint32_t cor);

void DesenhaFoguete(int X, int Y);
void DesenhaBola(int X, int Y);
void DesenhaBolao(int X, int Y, int Nivel);
void DesenhaMetralha(int X, int Y);
void DesenhaInimigo(int X, int Y);
void DesenhaEstrela(int X, int Y);

void DesenhaChuva(int X, int Y);
void DesenhaMeteoro(int X, int Y);

int TamBolao(int Nivel);

#define COLORREF uint32_t

uint32_t RGB(uint8_t r, uint8_t g, uint8_t b);
extern int CursorX, CursorY, BotaoE, BotaoD;
#endif
