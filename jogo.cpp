// vim: tabstop=4 shiftwidth=4

#include <SDL2/SDL.h>
#include <iostream>
#include <sstream>
#include <stdio.h>
#include "tiro.h"
#include "jogo.h"

using namespace std;

Janela::Janela() {
	if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_TIMER)) goto errosdl;
	sdlwin = SDL_CreateWindow("Jogo Tosco de dar Tiro", SDL_WINDOWPOS_UNDEFINED, SDL_WINDOWPOS_UNDEFINED, 640, 480, SDL_WINDOW_SHOWN);
	if (sdlwin == NULL) goto errosdl;
	surf = SDL_GetWindowSurface(sdlwin);
	if (surf == NULL) goto errosdl;
	atexit(SDL_Quit);
	return;
errosdl:
	cerr << "Erro inicializando SDL\n";
	exit(1);
}
void Janela::Desenha(SDL_Surface *img, int x, int y, int w, int h) {
	SDL_Rect r;
	r.x = x;
	r.y = y;
	r.w = w;
	r.h = h;
	SDL_BlitSurface(img, NULL, surf, &r);
}
void Janela::DesenhaCaixa(int x, int y, int largura, int altura, uint32_t cor) {
	SDL_Rect r;
	r.x = x;
	r.y = y;
	r.w = largura;
	r.h = altura;
	SDL_FillRect(surf, &r, cor); 
}
Janela::~Janela() {
	SDL_DestroyWindow(sdlwin);
}
uint32_t Janela::rgb(uint8_t r, uint8_t g, uint8_t b) {
	return SDL_MapRGB(surf->format, r, g, b);
}
void Janela::ProcessaFrame() {
	SDL_FillRect(surf, NULL, 0); 
	ProcessaJogo();
	SDL_UpdateWindowSurface(sdlwin);
}

Janela janela;

void Janela::Escreve(const char *texto) {

}

uint32_t RGB(uint8_t r, uint8_t g, uint8_t b) {
	return janela.rgb(r, g, b);
}

class Imagem {
	private:
		int Altura, Largura;
		SDL_Surface *surf;
		const char *nom;
	public:
		Imagem() {
			Altura = Largura = 0;
			surf = NULL;
		}
		Imagem(Imagem &b) {
			Altura = b.Altura;
			Largura = b.Largura;
			surf = b.surf;
		}
		Imagem(int TamX, int TamY, const char *NomeArq) {
			nom = NomeArq;
			surf = SDL_LoadBMP(NomeArq);
			if (surf == NULL)
				throw string("Erro carregando imagem de ") + NomeArq;
			Altura = TamY;
			Largura = TamX;
		}
		void Desenha(int X, int Y) {
			janela.Desenha(surf, X, Y, Largura, Altura);
		}
};

int CursorX = 100, CursorY = 100, BotaoD, BotaoE;


Imagem Boloes[3];
Imagem Bola, Foguete, Metralha, Inimigo, Estrela, Chuva, Meteoro;

void CarregaRecursos() {
	int i;
	Bola = Imagem(10, 10, "bola.bmp");
	Foguete = Imagem(48, 48, "foguete.bmp");
	Metralha = Imagem(48, 48, "metralha.bmp");
	Inimigo = Imagem(20, 20, "inimigo.bmp");
	Estrela = Imagem(64, 48, "estrela.bmp");
	Chuva = Imagem(20, 20, "chuva.bmp");
	Meteoro = Imagem(5, 5, "meteoro.bmp");
	for (i = 0; i < 3; i++) {
		ostringstream oss;
		oss << "bola" << (i+1) << ".bmp";
		Boloes[i] = Imagem(TamBolao(i), TamBolao(i), oss.str().c_str());
	}
}

void DesenhaChuva(int X, int Y) {
	Chuva.Desenha(X, Y);
}

void DesenhaMeteoro(int X, int Y) {
	Meteoro.Desenha(X, Y);
}

void DesenhaEstrela(int X, int Y) {
	Estrela.Desenha(X, Y);
}

void DesenhaBola(int X, int Y) {
	Bola.Desenha(X, Y);
}

void DesenhaInimigo(int X, int Y) {
	Inimigo.Desenha(X, Y);
}

void DesenhaMetralha(int X, int Y) {
	Metralha.Desenha(X, Y);
}

void DesenhaFoguete(int X, int Y) {
	Foguete.Desenha(X, Y);
}

int TamBolao(int Nivel) {
	switch (Nivel) {
		case 0: return 20;
		case 1: return 18;
		case 2: return 14;
		case 3: return 10;
	}
	return 0;
}

void DesenhaBolao(int X, int Y, int Nivel) {
	if (Nivel < 0 || Nivel > 3) return;
	if (Nivel == 3) 
		Bola.Desenha(X, Y);
	else
		Boloes[Nivel].Desenha(X, Y);
}


void Caixa(int x, int y, int largura, int altura, uint32_t cor) {
	janela.DesenhaCaixa(x, y, largura, altura, cor);
}

uint32_t tictac(uint32_t i, void *p) {
	SDL_Event e;
	e.type = SDL_USEREVENT;
	e.user.code = 1;
	SDL_PushEvent(&e);
	return 0;
}

int main(int argc, char **argv) {
	SDL_Event evento;
	SDL_AddTimer(30, tictac, NULL);
	try {
		CarregaRecursos();
		for (;;) 
			while (SDL_PollEvent(&evento)) {
				if (evento.type == SDL_QUIT)
					return 0;
				if (evento.type == SDL_KEYDOWN && evento.key.keysym.sym == SDLK_ESCAPE)
					return 0;
				if (evento.type == SDL_MOUSEMOTION) {
					CursorX = evento.motion.x;
					CursorY = evento.motion.y;
				}
				if (evento.type == SDL_MOUSEBUTTONDOWN || evento.type == SDL_MOUSEBUTTONUP) {
					if (evento.button.button == SDL_BUTTON_LEFT)
						BotaoE = evento.button.state;
					if (evento.button.button == SDL_BUTTON_RIGHT)
						BotaoD = evento.button.state;
				}
				if (evento.type == SDL_USEREVENT) {
					janela.ProcessaFrame();
					SDL_AddTimer(30, tictac, NULL);
				}
			} 
	} catch (string s) {
		cerr << s << "\n";
	}
}

