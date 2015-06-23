#include <ddraw.h>
#include <stdlib.h>
#include <math.h>
#include "tiro.h"

const cCoisaNaTela = 0;
const cNave = 1;
const cMaximoVida = 1000;
const cVidaInimigo = 5;
const cVidaMeteoro = 1;
const cVidaChuva = 50;
const cVidaMissil = 1;
const cRandoms = 100;

const cPontosInimigo = 5;
const cPontosMeteoro = 1;
const cPontosMetralha = 20;
const cPontosChuva = 100;
const cMaximoCarga = 1000;

const double cPI = 3.141592;
const double cConverte = cPI/180; // pi/180
const double cDPI = cPI*2; // 2*pi

int PopulacaoInimigo = 0;
int PopulacaoJogador = 0;
int Pontos = 0;
int Excluidos = 0;
int BarraEnergia;
int JogX, JogY;
int Continua;
int Tempo = 0;
int Carga = 0;

int random(int Maximo) {
	return rand() * Maximo / RAND_MAX;
}

void InsereDestroco(int X, int Y);

double AnguloDir(double X, double Y);

// ---------------------------------------------------------------------
// ------------------------Definicoes de classe-------------------------
// ---------------------------------------------------------------------
class CoisaNaTela {
   private:
      CoisaNaTela *Seguinte;   // Ponteiro para lista encadeada
      friend class Lista;
   public:
      int CentroX, CentroY;
      int Largura, Altura, Tipo;
      Lista *Mae;

      CoisaNaTela(int CX, int CY, int L, int A, Lista *M);
      virtual ~CoisaNaTela();
      virtual void Desenha() =0;  // Desenha o objeto na tela
      virtual void Processa() =0; // Calcula proxima posicao do objeto, etc

      void MantemNaTela(); // se fora da tela, coloca de volta na marra
      int ForaDaTela();
	  int PosX();
	  int PosY();
      inline CoisaNaTela *Proximo() {
         return Seguinte;
      }
};

class Lista {
   private:
      CoisaNaTela *Primeiro;
   public:
      Lista();
      ~Lista();
      void Inclui(CoisaNaTela *Coisa);
      void Exclui(CoisaNaTela *Coisa);
      CoisaNaTela *Inicio();
      void Desenha();
      void Processa();
};

class Nave : public CoisaNaTela {
   public:
      int Energia, LiberaDestroco;
      Nave(int E, int CX, int CY, int L, int A, Lista *M);
      ~Nave();
      virtual int TomaPorrada(int E);
      virtual void Catapimba() {};
      inline void Pulsa(double Inc = 0.5);
      inline void Holocausto(double i=0, double f=6.28, double inc=0.1, int N=0);
};

class Destroco : public CoisaNaTela {
   public:
      int RestoX, RestoY, IncX, IncY;
      int DirX, DirY;
      int Dist;
      int Cor;
      Destroco(int CX, int CY, Lista *M, double Ang = -1);
      virtual void Desenha();
      virtual void Processa();
};

class Teleguiado : public Nave {
   public:
      double VelX, VelY;
      int Tempo;
      Teleguiado(int CX, int CY, Lista *M);
      virtual void Desenha();
      virtual void Processa();
      virtual void Catapimba();
};

class Meteoro : public Nave {
   public:
      int DirX, DirY, IncX, IncY, RestoX, RestoY;
      Meteoro(Lista *M);
      virtual void Desenha();
      virtual void Processa();
      virtual void Catapimba();
};

class Missil : public Nave {
   public:
      int DirX, DirY, RestoX, RestoY, IncX, IncY;
      Missil(int CX, int CY, double MX, double MY, Lista *M);
      virtual void Processa();
      virtual void Desenha();
};

class Inimigo : public Nave {
   public:
      int Movimento; // 0=baixo, 1=cima, 2=esquerda, 3=direita, 4=parado
      int Distancia;
      int TempoDisparo;
      int Cor;
      Inimigo(Lista *M);
      Inimigo(int X, int Y, Lista *M);
      virtual void Catapimba();
      virtual void Desenha();
      virtual void Processa();
};

class Lazer : public Nave {
   public:
      Lazer(Lista *M);
      virtual void Desenha();
      virtual void Processa();
};

COLORREF CorRandomica() {
	return RGB(random(256), random(256), random(256));
}

class Redemoinho : public Nave {
   public:
      Redemoinho(Lista *M);
      virtual void Desenha();
      virtual void Processa();
      virtual void Catapimba();
};


class Chuva : public Nave {
   public:
      int Raio;
      Chuva(Lista *M);
      Chuva(int CX, int CY, Lista *M);
      virtual void Desenha();
      virtual void Processa();
      virtual void Catapimba();
};

class Metralha : public Nave {
   public:
      Metralha(Lista *M);
      Metralha(int CX, int CY, Lista *M);
      virtual void Desenha();
      virtual void Processa();
      virtual void Catapimba() { Pontos += cPontosMetralha; };
};

class Transporte : public Nave {
   public:
      Transporte(Lista *M);
      void Desenha();
      void Processa();
};

class Encrenca : public Nave {
   public:
      Encrenca(Lista *M);
      void Desenha();
      void Processa();
};

class Jogador : public Nave {
   private:
      int TempoDisparo;
   public:
      Jogador(Lista *M);
      virtual void Catapimba();
      virtual void Desenha();  // Desenha o jogador na tela
      virtual void Processa(); // Determina o movimento
};

class Nuclear : public Missil {
public:
	double Angulo;
	int Nivel;
	Nuclear(int CX, int CY, double MX, double MY, Lista *M, int N = 0) : Missil(CX,CY,MX,MY,M) {
		Altura = Largura = TamBolao(N);
		Angulo = AnguloDir(MX, MY);
		Nivel = N;
	};

      virtual void Desenha();
      virtual void Catapimba();
};

// ---------------------------------------------------------------------
// ------------Funcoes gerais ------------------------------------------
// ---------------------------------------------------------------------



int MaxX() {
   return 640;
}

int MaxY() {
   return 480;
}

int Sinal(int N) {
   if (N < 0) return -1;
   if (N > 0) return 1;
   return 0;
}

inline int Entre(int min, int max) {
   return random(max-min)+min;
}



int Distancia(double x1, double y1, double x2, double y2) {
   double dx, dy;
   dx = fabs(x1-x2);
   dy = fabs(y1-y2);
   if (!dx) return (int) dy;
   if (!dy) return (int) dx;
   return (int) sqrt(dx*dx+dy*dy);
}

int Temporiza(int X) {
   return !(Tempo % X);
}

double AnguloDir(double X, double Y) {
   double Dist;
   Dist = sqrt(X*X + Y*Y);
   if (!Dist) return 0;
   if (X < 0) return asin(-Y/Dist) + cPI;
   return asin(Y / Dist);
}

// ---------------------CoisaNaTela-------------------------------------


CoisaNaTela::~CoisaNaTela() {
}

CoisaNaTela::CoisaNaTela(int CX, int CY, int L, int A, Lista *M) {
   Mae = M;
   CentroX = CX;
   CentroY = CY;
   Largura = L;
   Altura = A;
   Tipo = cCoisaNaTela;
}

void CoisaNaTela::MantemNaTela() {
   if (CentroX-Largura/2 < 0) CentroX = Largura/2;
   if (CentroY-Altura/2 < 0) CentroY = Altura/2;
   if (CentroX+Largura/2 > MaxX()) CentroX = MaxX() - Largura/2;
   if (CentroY+Altura/2 > MaxY()) CentroY = MaxY() - Altura/2;
}

int CoisaNaTela::ForaDaTela() {
   return (CentroX-Largura<0 || CentroX+Largura>MaxX()) || (CentroY-Altura<0 || CentroY+Altura>MaxY());
}
// ---------------------Lista-------------------------------------------
// Lista de objetos da tela

Lista::Lista() {
   Primeiro = NULL;
}

CoisaNaTela *Lista::Inicio() {
   return Primeiro;
}

void Lista::Inclui(CoisaNaTela *Coisa) {
   Coisa->Seguinte = Primeiro;
   Primeiro = Coisa;
}

void Lista::Exclui(CoisaNaTela *Coisa) {
   CoisaNaTela *Contador;
   CoisaNaTela *Anterior;
   Excluidos++;
   Anterior = NULL;
   Contador = Primeiro;
   while (Contador != NULL) {
      if (Contador == Coisa) {
         if (Anterior != NULL)
            Anterior->Seguinte = Contador->Proximo();
         else
            Primeiro = Contador->Proximo();
         delete Contador;
         return;
      } else
         Anterior = Contador;
         Contador = Contador->Proximo();
   }
}

Lista::~Lista() {
   while (Primeiro != NULL) Exclui(Primeiro);
};




//-------------------Destroco----------------------------------------------

Destroco::Destroco (int CX, int CY, Lista *M, double Ang) : CoisaNaTela(CX, CY, 1, 1, M) {
   double Vel;
   if (Ang == -1) Ang = random(628) / 100.0;
   RestoX = RestoY = 0;
   Vel = random(100);
   DirX = (int) (Vel * cos(Ang));
   DirY = (int) (Vel * sin(Ang));
   IncX = Sinal(DirX);
   IncY = Sinal(DirY);
   DirX = abs(DirX);
   DirY = abs(DirY);
   Dist = random(100);
   Cor = random(256);;
}

void Destroco::Desenha() {
   Caixa(PosX(), PosY(), 1, 1, Cor);
   //DesenhaPixel(CentroX, CentroY, Cor);
}

void Destroco::Processa() {
   RestoX += DirX;
   RestoY += DirY;
   while (RestoX > 100) {
      RestoX -= 100;
      CentroX += IncX;
   }
   while (RestoY > 100) {
      RestoY -= 100;
      CentroY += IncY;
   }
   if (Dist-- < 1) Mae->Exclui(this);
}

// ---------------------Nave--------------------------------------------

      // Disparos tambem sao considerados naves
      // Energia determina o tempo que  a nave demorara para se destruir
      // Origem determina se o objeto foi lancado pelo jogador, oponente
      // ou se e um destroco. Objetos com o iguais nao se chocam
      // Tomaporrada decrementa a energia da nave proporcionalmente
      // e remove o objeto da lista se a nave for destruida

void Nave::Pulsa(double Inc) {
   double Ang;
   for (Ang = 0; Ang < 6.28; Ang += Inc) {
      Mae->Inclui(new Missil(CentroX, CentroY, cos(Ang)*10, sin(Ang)*10, Mae));
   }
}

void Nave::Holocausto(double i, double f, double inc, int N) {
   double Ang;
   for (Ang = i; Ang < f; Ang += inc) {
      Mae->Inclui(new Nuclear(CentroX, CentroY, cos(Ang)*5, sin(Ang)*5, Mae, N));
   }
}

Nave::Nave(int E, int CX, int CY, int L, int A, Lista *M) : CoisaNaTela(CX, CY, L, A, M) {
   Energia = E;
   LiberaDestroco = 500;
   Tipo = cNave;
};

int Nave::TomaPorrada(int E) {
   Energia -= E;
   if (Energia < 1) {
      Catapimba();
      Mae->Exclui(this);
      return 1;
   }
   return 0;
}


Nave::~Nave() {
   int i;
   // CoisaNaTela::~CoisaNaTela();
   if (LiberaDestroco && !ForaDaTela())
      for (i = 0; i<LiberaDestroco; i++) InsereDestroco(CentroX, CentroY);
}



//---------------------Teleguiado-------------------------------------------

void Teleguiado::Catapimba() {
   Pontos++;
};

Teleguiado::Teleguiado(int CX, int CY, Lista *M) : Nave(1, CX, CY, 10, 10, M) {
   Tempo = 0;
   VelX = VelY = 0;
   LiberaDestroco = 10;
}

void Teleguiado::Desenha() {
   DesenhaBola(PosX(), PosY());
}

void Teleguiado::Processa() {
   double DeltaX, DeltaY, Dist;
   DeltaX = CentroX - JogX;
   DeltaY = CentroY - JogY;
   Dist = Distancia(CentroX, CentroY, JogX, JogY); if (!Dist) Dist++;
   DeltaX = DeltaX / Dist / 5;
   DeltaY = DeltaY / Dist / 5;
   VelX = (VelX - DeltaX) * 0.99;
   VelY = (VelY - DeltaY) * 0.99;
   CentroX += (int) VelX;
   CentroY += (int) VelY;
   if (++Tempo > 1000) Mae->Exclui(this);
}
//---------------------Meteoro----------------------------------------------

Meteoro::Meteoro(Lista *M) : Nave (cVidaMeteoro, 5, random(MaxY()), 5, 5, M) {
   double Ang;
   switch (random(4)) {
      case 0:
         CentroX = 10;
         CentroY = random(MaxY()-10);
         Ang = random(90);
         if (Ang > 45) Ang += 269;
         break;
      case 1: CentroX = MaxX()-10; CentroY = random(MaxY()-10); Ang = Entre(135, 225); break;
      case 2: CentroX = random(MaxX()-10); CentroY = 10; Ang = Entre(45, 135); break;
      case 3: CentroX = random(MaxX()-10); CentroY = MaxY()-10; Ang = Entre(225, 315); break;
   }
   Ang *= cConverte;
   DirX = (int) (200*cos(Ang));
   DirY = (int) (200*sin(Ang));
   IncX = Sinal(DirX);
   IncY = Sinal(DirY);
   DirX = abs(DirX);
   DirY = abs(DirY);
   RestoX = RestoY = 0;
   LiberaDestroco = 10;
}

void Meteoro::Catapimba() {
   Pontos += cPontosMeteoro;
}

void Meteoro::Processa() {
   RestoX += DirX;
   RestoY += DirY;
   while (RestoX >= 100) {
      RestoX -= 100;
      CentroX += IncX;
   }
   while (RestoY >= 100) {
      RestoY -= 100;
      CentroY += IncY;
   }
   if (ForaDaTela()) Mae->Exclui(this);
}

void Meteoro::Desenha() {
	DesenhaMeteoro(PosX(), PosY());
}

//---------------------Missil-----------------------------------------------

Missil::Missil(int CX, int CY, double MX, double MY, Lista *M) : Nave(cVidaMissil, CX, CY, 10, 10, M) {
   DirX = (int) (MX*100);
   DirY = (int) (MY*100);
   IncX = Sinal(DirX);
   IncY = Sinal(DirY);
   DirX = abs(DirX);
   DirY = abs(DirY);
   RestoX = RestoY = 0;
   LiberaDestroco = 10;
};

void Missil::Processa() {
   RestoX += DirX;
   RestoY += DirY;
   while (RestoX >= 100) {
      RestoX -= 100;
      CentroX += IncX;
   }
   while (RestoY >= 100) {
      RestoY -= 100;
      CentroY += IncY;
   }
   if (ForaDaTela())
      Mae->Exclui(this);
}

void Missil::Desenha() {
	DesenhaBola(PosX(), PosY());
   //Linhas.Desenha(CentroX, CentroY, RGB(0, 0, 255));
}

void Nuclear::Desenha() {
	DesenhaBolao(PosX(), PosY(), Nivel);
}

void Nuclear::Catapimba() {
   if (Nivel >= 3) return;
   if (Angulo > 3.14) Angulo -= 3.14; else Angulo += 3.14;
   CentroX += (int) (cos(Angulo) * 10);
   CentroY += (int) (sin(Angulo) * 10);
   Holocausto(Angulo-1, Angulo+1, 0.5, Nivel+1);
//   Holocausto(0, 6.28, 1, Nivel+1);
//   Pulsa();
}

//------------------Inimigo-------------------------------------------------


Inimigo::Inimigo(Lista *M) : Nave(cVidaInimigo,0,30,20,20,M) {
   int i;
   i = random(55) + 200;
   Cor = RGB(i, i, i);
   CentroX = random(320-60)+30;
   Movimento = random(4);
   Distancia = random(50);
   TempoDisparo = random(100)+20;
   PopulacaoInimigo++;
}

Inimigo::Inimigo(int X, int Y, Lista *M) : Nave(cVidaInimigo, X, Y, 20, 20, M) {
   CentroX = X;
   CentroY = Y;
   Distancia = 0;
   TempoDisparo = 100;
   PopulacaoInimigo++;
}

void Inimigo::Catapimba() {
   PopulacaoInimigo--;
   Pontos += cPontosInimigo;
}

void Inimigo::Processa() {
   switch(Movimento) {
      case 0: CentroY++; break;
      case 1: CentroY--; break;
      case 2: CentroX--; break;
      case 3: CentroX++; break;
      // 4=parado
   }
   if (Distancia >= 0)
      Distancia--;
   else {
      Distancia = random(50);
      Movimento = random(5);
   }
   if ((CentroY-20) < 20) { Movimento = 0; Distancia = 10; }
   if (CentroY > (MaxY()/2)) { Movimento = 1; Distancia = 10; }
   if ((CentroX+20) > MaxX()) { Movimento = 2; Distancia = 10; }
   if ((CentroX-20) < 0) { Movimento = 3; Distancia = 10; }

   if (!TempoDisparo) {
      TempoDisparo = random(180)+20;
      Mae->Inclui(new Missil(CentroX-9, CentroY+20, 0, 3, Mae));
      Mae->Inclui(new Missil(CentroX+9, CentroY+20, 0, 3, Mae));
   } else
      TempoDisparo--;
}

void Inimigo::Desenha() {
	DesenhaInimigo(PosX(), PosY());
}

// ---------Lazer Jogador---------------------------------------------------

Lazer::Lazer(Lista *M) : Nave(2, JogX, JogY-10, 2, 50, M) {
   LiberaDestroco = 10;
}

void Lazer::Desenha() {
   Caixa(CentroX-1, CentroY-25, 2, 50, 2);
}

void Lazer::Processa() {
   CentroY -= 10;
   CentroX = JogX;
   if (CentroY < 40) Mae->Exclui(this);
}

//-----------------Redemoinho-----------------------------------------------

void Redemoinho::Catapimba() {
   Pontos += 100;
   Pulsa(0.05);
}

Redemoinho::Redemoinho(Lista *M) : Nave(100, random(MaxX()-40)+20,40,64,48,M){}

void Redemoinho::Desenha() {
//	Retangulo(CentroX-(Largura/2), CentroY-(Altura/2), CentroX+(Largura/2), CentroY+(Altura/2), RGB(128, 0, 0));
	DesenhaEstrela(PosX(), PosY());
}

void Redemoinho::Processa() {
   if (Temporiza(10)) {
      if (Pontos > 5000) if (Temporiza(50)) Pulsa();
      if (++CentroY > MaxY()) Mae->Exclui(this);
   }
}


//---------------------Jogador----------------------------------------------

// Comeca sempre no mesmo lugar da tela


// Massa e energia = 10
// Origem 0 = humano
// no centro inferior da tela
// tamanho 20x20
Jogador::Jogador(Lista *M) : Nave(cMaximoVida, MaxX()/2, MaxY()-80, 48, 48, M) {
   Carga = cMaximoCarga;
   TempoDisparo = 0;
   PopulacaoJogador++;
   //MoveMouse(CentroX, CentroY);
   Pontos = 0;
}

void Jogador::Catapimba() {
   PopulacaoJogador--;
   BarraEnergia = 0;
}

void Jogador::Desenha() {
	DesenhaFoguete(CentroX - (Largura/2), CentroY - (Altura/2));
}

void Jogador::Processa() {
   double DeltaX, DeltaY, Dist;

   DeltaX = CursorX - JogX;
   DeltaY = CursorY - JogY;
   Dist = sqrt(DeltaX*DeltaX+DeltaY*DeltaY);
   if (Dist > 20) {
      DeltaX = DeltaX*20/Dist;
      DeltaY = DeltaY*20/Dist;
      CentroX += (int) DeltaX;
      CentroY += (int) DeltaY;
      MantemNaTela();
   } else {
      CentroX = CursorX;
      CentroY = CursorY;
      MantemNaTela();
   }

   if (Carga < cMaximoCarga) Carga++;
   if (TempoDisparo < 1000) TempoDisparo++;
   if (Carga >= 20 && TempoDisparo >= 5) {
      if (BotaoE) {
         TempoDisparo = 0;
         Carga -= 10;
         if (Pontos >= 500) {
            Mae->Inclui(new Lazer(Mae));
         } else {
            Mae->Inclui(new Missil(CentroX, CentroY-5, 0, -10, Mae));
         }
      }
   }
   if (Carga == cMaximoCarga) {
      if (Energia < cMaximoVida && Temporiza(10)) {
         Energia++;
      }
   }
   if (BotaoD && Carga >= cMaximoCarga && TempoDisparo) {
      Holocausto();
      Carga = 0;
      TempoDisparo = 0;
   }
   if (BotaoD && Carga >= 150 && TempoDisparo > 50) {
      Pulsa(0.05);
      Carga -= 50;
      TempoDisparo = 0;
   }

   BarraEnergia = Energia;
   JogX = CentroX;
   JogY = CentroY;
}

//--------------------Chuva-------------------------------------------------

Chuva::Chuva(Lista *M) : Nave(100, random(MaxX()-40)+20, 40, 20, 20, M) {
   Raio = 0;
};

Chuva::Chuva(int CX, int CY, Lista *M) : Nave(10, CX, CY, 20, 20, M) {
   Raio = 0;
}

void Chuva::Desenha() {
	DesenhaChuva(PosX(), PosY());
}

void Chuva::Processa() {
   double i;
   if (Temporiza(10)) {
      CentroY++;
      if (++Raio >= 5) {
         Mae->Inclui(new Teleguiado(CentroX, CentroY, Mae));
         Raio = 0;
      }
   }
   if (Temporiza(100)) {
      for (i = (45*cConverte); i <= (135*cConverte); i += 0.1)
         Mae->Inclui(new Missil(CentroX, CentroY, 2*cos(i), 2*sin(i), Mae));
      if ((CentroY+20) > MaxY()) Mae->Exclui(this);
   }
}

void Chuva::Catapimba() {
   Pontos += cPontosChuva;
}

//-------------------Metralha-----------------------------------------------

Metralha::Metralha(Lista *M) : Nave(10, random(MaxX()-96)+48, 48, 48, 48, M) {}
Metralha::Metralha(int CX, int CY, Lista *M) : Nave(10, CX, CY, 48, 48, M) {}

void Metralha::Desenha() {
	DesenhaMetralha(PosX(), PosY());
   //for (int i = 1; i <= 5; i++) Retangulo(CentroX-i*2, CentroY-i*2, CentroX+i*2, CentroY+i*2, RGB(0, 255, 100));
}

void Metralha::Processa() {
   double dx, dy, Dist;
   if (Temporiza(25)) {
      dx = JogX - CentroX;
      dy = JogY - CentroY;
      Dist = sqrt(dx*dx+dy*dy); if (!Dist) Dist++;
      dx = dx *5 / Dist; dy = dy *5 / Dist;
      Mae->Inclui(new Missil(CentroX, CentroY, dx, dy, Mae));
   }
   if (Temporiza(10)) {
      CentroY++;
      if (ForaDaTela()) Mae->Exclui(this);
   }
}

//----------------------Transporte------------------------------------------

Transporte::Transporte(Lista *M) : Nave(500, 0, random(MaxY()/2-40)+40, 100, 20, M) {};

void Transporte::Desenha() {
   Caixa(CentroX-50, CentroY-10, 100, 20, RGB(100, 80, 80));
}

void Transporte::Processa() {
   if (Temporiza(50)) Mae->Inclui(new Metralha(CentroX, CentroY, Mae));
   if (Temporiza(10)) CentroY++;
   if (++CentroX > MaxX()) Mae->Exclui(this);
}

// --------------Encrenca---------------------------------------------------


Encrenca::Encrenca(Lista *M) : Nave(500, 0, random(MaxY()/2-40)+40, 100, 20, M) {};

void Encrenca::Desenha() {
   Caixa(CentroX-50, CentroY-10, 100, 20, RGB(80, 80, 80));
}

void Encrenca::Processa() {
   if (Temporiza(100)) Mae->Inclui(new Chuva(CentroX, CentroY, Mae));
   if (Temporiza(10)) CentroY++;
   if (++CentroX > MaxX()) Mae->Exclui(this);
}

// ------Programa principal-------------------------------------------------

inline int Colide(Nave *a, Nave *b) {
   int DeltaX, DeltaY;
   DeltaX = abs(a->CentroX - b->CentroX) - (a->Largura/2) - (b->Largura/2);
   DeltaY = abs(a->CentroY - b->CentroY) - (a->Altura/2) - (b->Altura/2);
   return (DeltaX <= 0) && (DeltaY < 0);
}

inline void Testa(Nave *a, Nave *b) {
   int ea;
   if (Colide(a, b)) {
      ea = a->Energia; // necessario salvar antes
      a->TomaPorrada(b->Energia);
      b->TomaPorrada(ea);
   }
}

void TestaLista (Nave *i, Lista *L) {
   Nave *j, *sj;
   j = (Nave *) L->Inicio();
   while (j) {
      sj = (Nave *) j->Proximo();
      Testa((Nave *) i, (Nave *) j);
      j = sj;
      if (Excluidos) j = NULL;
   }
}

void DistribuiPancadas(Lista *L1, Lista *L2) {
   CoisaNaTela *i, *si;
   Excluidos = 1;
   while (Excluidos) {
      i = L1->Inicio();
      Excluidos = 0;
      while (i) {
         si = i->Proximo();
         TestaLista ((Nave *) i, L2);
         if (Excluidos) si = NULL;
         i = si;
      }
   }
}

void EspancaEscudo(Lista *L1, Lista *L2) {
   CoisaNaTela *i, *si;
   int Dist;
   Excluidos = 1;
   while (Excluidos) {
      i = L1->Inicio();
      Excluidos = 0;
      while (i) {
         si = i->Proximo();
         Dist = Distancia(0, 0, i->Largura, i->Altura) + 40;
         if (Distancia(i->CentroX, i->CentroY, JogX, JogY) <= Dist) {
            TestaLista((Nave *) i, L2);
         }
         if (Excluidos) si = NULL;
         i = si;
      }
   }
}

void DesenhaBarra(int Y1, int Altura, int Valor, int Maximo, int Cor) {
   if (!Maximo) Maximo++;
   Caixa (1, Y1, (int) (double (Valor) * (MaxX()-5) / Maximo), Altura, Cor);
}

void MostraPontos() {
   DesenhaBarra(1, 4, BarraEnergia, cMaximoVida, 1);
   DesenhaBarra(7, 4, Carga, cMaximoCarga, 4);
}


void Lista::Desenha() {
   CoisaNaTela *Contador;
   Contador = Primeiro;
   while (Contador) {
      Contador->Desenha();
      Contador = Contador->Proximo();
   }
}


void Lista::Processa() {
   CoisaNaTela *Contador, *Proximo;
   Contador = Inicio();
   while (Contador) {
      Proximo = Contador->Proximo();
      Contador->Processa();
      Contador = Proximo;
   }
}



Lista ListaAmigos, ListaInimigos, ListaDestrocos;

void InsereMetralha() {
   if (Pontos >= 500)
      ListaInimigos.Inclui(new Transporte(&ListaInimigos));
   else
      ListaInimigos.Inclui(new Metralha(&ListaInimigos));
}

void InsereChuva() {
   if (Pontos >= 500) {
      if (Pontos >= 5000)
         ListaInimigos.Inclui(new Encrenca(&ListaInimigos));
      else
         ListaInimigos.Inclui(new Chuva(&ListaInimigos));
   } else
      ListaInimigos.Inclui(new Redemoinho(&ListaInimigos));
}

void InsereInimigo(int Qtd = 1) {
   for (int i = 0; i < Qtd; i++) {
      ListaInimigos.Inclui(new Inimigo(&ListaInimigos));
   }
}

int Possib(int Desvio, int Prob) {
   int Resposta;
   Tempo += Desvio;
   Resposta = Temporiza(500) && (random(100) < Prob);
   Tempo -= Desvio;
   return Resposta;
}

void InsereRedemoinho() {
   ListaInimigos.Inclui(new Redemoinho(&ListaInimigos));
}

void IncluiInimigos() {
   if (Possib(0, 30)) InsereMetralha();
   if (Possib(100, 30)) InsereChuva();
   if (Possib(200, 30)) for (int j = 0; j < 50; j++) ListaInimigos.Inclui(new Meteoro(&ListaInimigos));
   if (Possib(300, 30)) InsereRedemoinho();
   if ((PopulacaoInimigo < 25) && Possib(400, 30)) InsereInimigo(3);
}

//////////////////////////////////////////////////////////////////////

void VerificaNovoJogador() {
   if (!PopulacaoJogador) ListaAmigos.Inclui(new Jogador(&ListaAmigos));
}
void Desenha() {
   ListaInimigos.Desenha();
   ListaAmigos.Desenha();
   ListaDestrocos.Desenha();
}


void Processa() {
   ListaAmigos.Processa();
   ListaInimigos.Processa();
   ListaDestrocos.Processa();
}

void InsereDestroco(int X, int Y) {
   ListaDestrocos.Inclui(new Destroco(X, Y, &ListaDestrocos));
}

void ProcessaJogo() {
	VerificaNovoJogador();
	MostraPontos();
	Processa();
	DistribuiPancadas(&ListaAmigos, &ListaInimigos);
	Desenha();
	if (PopulacaoJogador) IncluiInimigos();
	Tempo++;
 }

int CoisaNaTela::PosX() {
	return CentroX - (Largura/2);
}

int CoisaNaTela::PosY() {
	return CentroY - (Altura/2);
}