#ifndef TIRO_H
#define TIRO_H

int random(int Maximo);

void ProcessaJogo();
void Caixa(int x1, int y1, int Largura, int Altura, int Cor);

void DesenhaFoguete(int X, int Y);
void DesenhaBola(int X, int Y);
void DesenhaBolao(int X, int Y, int Nivel);
void DesenhaMetralha(int X, int Y);
void DesenhaInimigo(int X, int Y);
void DesenhaEstrela(int X, int Y);

void DesenhaChuva(int X, int Y);
void DesenhaMeteoro(int X, int Y);

int TamBolao(int Nivel);

extern int CursorX, CursorY, BotaoE, BotaoD;
#endif