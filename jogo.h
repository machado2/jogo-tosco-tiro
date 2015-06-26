// vim: tabstop=4 shiftwidth=4

#include <SDL2/SDL.h>
#include <iostream>
#include <sstream>
#include <stdio.h>
#include "tiro.h"

using namespace std;

class Janela {
	private:
		SDL_Window *sdlwin = NULL;
		SDL_Surface *surf = NULL;
	public:
		Janela(); 
		void Desenha(SDL_Surface *img, int x, int y, int w, int h);
		void DesenhaCaixa(int x, int y, int largura, int altura, uint32_t cor);
		~Janela();
		uint32_t rgb(uint8_t r, uint8_t g, uint8_t b);
		void ProcessaFrame();
		void Escreve(const char *texto);
};

extern Janela janela;

