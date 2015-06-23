// *****************************************************************
// TESTE.CPP
// Controla a interface com o Rwindows 98
// *****************************************************************

#include <ddraw.h>
#include <stdio.h>
#include "tiro.h"
#include "ddutil.h"

class Imagem {
private:
	LPDIRECTDRAWSURFACE Superficie;
	int Altura, Largura;
	int Valido;
public:
	Imagem(int TamX, int TamY, char *NomeArq);
	Desenha(int X, int Y);
};

void Saida();
typedef Imagem *PImagem;

LPDIRECTDRAW DirectDraw;
LPDIRECTDRAWSURFACE SuperficiePrimaria, SuperficieSecundaria;
HWND Janela;		
char Conversao[80];
int CursorX = 100, CursorY = 100, BotaoD, BotaoE;

void Esconde() {
	if (Janela) ShowWindow(Janela, SW_HIDE);
}

void Derruba() {
	if (Janela) DestroyWindow(Janela);
}

void Ops(char *msg) {
	MessageBox(NULL, msg, "Erro no DirectDraw", MB_OK);
	Derruba();
}

void InformaErro(HRESULT Erro) {
	switch (Erro) {
	case DDERR_INCOMPATIBLEPRIMARY:
		Ops("Primario incompativel");
		break;
	case DDERR_INVALIDCAPS:
		Ops("CAPS invalido");
		break;
	case DDERR_INVALIDOBJECT:
		Ops("Objeto inválido");
		break;

	case DDERR_INVALIDPARAMS:
		Ops("Parâmetros inválidos");
		break;
	case DDERR_INVALIDPIXELFORMAT:
		Ops("Formato de pixel inválido");
		break;
	case DDERR_NOALPHAHW:
		Ops("Sem AlphaHW");
		break;
	case DDERR_NOCOOPERATIVELEVELSET:
		Ops("Sem COOPERATIVELEVEL setado");
		break;
	case DDERR_NODIRECTDRAWHW:
		Ops("Sem DirectDraw HW");
		break;
	case DDERR_NOEMULATION:
		Ops("Sem emulação");
		break;
	case DDERR_NOEXCLUSIVEMODE:
			Ops("Sem Modo Exclusivo");
		break;
	case DDERR_NOFLIPHW:
		Ops("Sem Flip HW");
		break;
	case DDERR_NOMIPMAPHW:
		Ops("Sem MIP MAP HW");
		break;
	case DDERR_NOOVERLAYHW:
		Ops("Sem overlay hw");
		break;
	case DDERR_NOZBUFFERHW:
		Ops("Sem zbuffer hw");
		break;
	case DDERR_OUTOFMEMORY:
		Ops("sem memoria");
		break;
	case DDERR_OUTOFVIDEOMEMORY:
		Ops("Sem memoria de video");
		break;
	case DDERR_PRIMARYSURFACEALREADYEXISTS:
		Ops("Ja existe superficie primaria");
		break;
	case DDERR_UNSUPPORTEDMODE:
		Ops("Modo nao suportado");
		break;
	default:
		Ops("Erro estranho no DDRAW");
	}
}

int CopiaBitmap(LPDIRECTDRAWSURFACE &Sup, HBITMAP bmp, int TamX, int TamY) {
	return DDCopyBitmap(Sup, bmp, 0, 0, 0, 0);
/*	HDC sdc, bdc;
	HRESULT Erro;
	HBITMAP Velho;
	if (!Sup || !bmp) return FALSE;
	Erro = Sup->Restore();
	if (!Erro) Erro = Sup->GetDC(&sdc);
	if (Erro == DD_OK) {
		bdc = CreateCompatibleDC(NULL);
		Velho = (HBITMAP) SelectObject(bdc, bmp);
		if (Velho) DeleteObject(Velho);
		BitBlt(sdc, 0, 0, TamX, TamY, bdc, 0, 0, SRCCOPY);
		Sup->ReleaseDC(sdc);
		DeleteDC(bdc);
		DeleteObject(bmp);
	} else if (Erro == DDERR_SURFACELOST) {
		Sup->Restore();
		CopiaBitmap(Sup, bmp, TamX, TamY);
	} else
		return FALSE;
	return TRUE;*/
}

Imagem::Imagem(int TamX, int TamY, char *NomeArq) {
	Superficie = DDLoadBitmap(DirectDraw, NomeArq, TamX, TamY);
	Valido = (Superficie != NULL);
	Largura = TamX;
	Altura = TamY;
}

Imagem::Desenha(int X, int Y) {
	RECT r;
	if (Valido) {
		r.left = 0;
		r.top = 0;
		r.right = Largura;
		r.bottom = Altura;
		SuperficieSecundaria->BltFast(X, Y, Superficie, &r, DDBLTFAST_NOCOLORKEY | DDBLTFAST_WAIT);
	}
}

char *NumToStr(int Num) {
	itoa(Num, Conversao, 10);
	return Conversao;
}

void Falha(char *Mensagem) {
	char msg[80]; 
	DWORD cod = GetLastError();  
	sprintf(msg, "%s : GetLastError = %u\n", 
        Mensagem, cod);
	MessageBox(NULL, msg, "MERDA", MB_OK); 
} 

PImagem Boloes[3];
PImagem Bola, Foguete, Metralha, Inimigo, Estrela, Chuva, Meteoro;

void CarregaRecursos() {
	int i;
	char Nome[80];
	Bola = new Imagem(10, 10, "bola.bmp");
	Foguete = new Imagem(48, 48, "foguete.bmp");
	Metralha = new Imagem(48, 48, "metralha.bmp");
	Inimigo = new Imagem(20, 20, "inimigo.bmp");
	Estrela = new Imagem(64, 48, "estrela.bmp");
	Chuva = new Imagem(20, 20, "chuva.bmp");
	Meteoro = new Imagem(5, 5, "meteoro.bmp");
	for (i = 0; i < 3; i++) {
		strcpy(Nome, "BOLA");
		strcat(Nome, NumToStr(i+1));
		strcat(Nome, ".bmp");
		Boloes[i] = new Imagem(TamBolao(i), TamBolao(i), Nome);
	}
}

void DescarregaRecursos() {
	int i;
	delete Bola; 
	delete Foguete;
	delete Metralha; 
	delete Inimigo;
	delete Estrela;
	delete Chuva;
	delete Meteoro;
	for (i = 0; i < 3; i++) {
		delete Boloes[i];
		Boloes[i] = NULL;
	}
}

void DesenhaChuva(int X, int Y) {
	Chuva->Desenha(X, Y);
}

void DesenhaMeteoro(int X, int Y) {
	Meteoro->Desenha(X, Y);
}

void DesenhaEstrela(int X, int Y) {
	Estrela->Desenha(X, Y);
}

void DesenhaBola(int X, int Y) {
	Bola->Desenha(X, Y);
}

void DesenhaInimigo(int X, int Y) {
	Inimigo->Desenha(X, Y);
}

void DesenhaMetralha(int X, int Y) {
	Metralha->Desenha(X, Y);
}

void DesenhaFoguete(int X, int Y) {
	Foguete->Desenha(X, Y);
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
	PImagem Temp;
	if (Nivel < 0 || Nivel > 3) return;
	if (Nivel == 3) 
		Temp = Bola;
	else
		Temp = Boloes[Nivel];
	Temp->Desenha(X, Y);	
}


void Caixa(int x, int y, int largura, int altura, int cor) {
	RECT r;
	DDBLTFX Params;
	r.left = x;
	r.top = y;
	r.right = x+largura;
	r.bottom = y + altura;
	Params.dwSize = sizeof(Params);
	Params.dwFillColor = cor;
	if (SuperficieSecundaria->IsLost() == DDERR_SURFACELOST) 
			SuperficieSecundaria->Restore();
	SuperficieSecundaria->Blt(&r, NULL, NULL, DDBLT_WAIT | DDBLT_COLORFILL, &Params);
}

void ProcessaFrame() {
	static BYTE Paginado = TRUE;
	HRESULT Erro;
	RECT TodaTela;
	DDBLTFX Params;
	if (Paginado) {
		TodaTela.bottom = 480;
		TodaTela.left = 0;
		TodaTela.right = 640;
		TodaTela.top = 0;
		Params.dwFillColor = RGB(0, 0, 0);
		Params.dwSize = sizeof(Params);
		if (SuperficieSecundaria->IsLost() == DDERR_SURFACELOST) 
			SuperficieSecundaria->Restore();
		SuperficieSecundaria->Blt(&TodaTela, NULL, NULL, DDBLT_WAIT | DDBLT_COLORFILL, &Params);
		ProcessaJogo();
		Paginado = 0;
	}
	if (!Paginado) {
		Erro = SuperficiePrimaria->Flip(NULL, 0);
		switch (Erro) {
		case DD_OK:
			Paginado = 1;
		case DDERR_SURFACELOST:
			SuperficiePrimaria->Restore();
			break;
		}
	}
}

void Saida() {
	if (DirectDraw) {
		if (SuperficiePrimaria) {
			SuperficiePrimaria->Release();
			SuperficiePrimaria = NULL;
		}
		DirectDraw->Release();
		DirectDraw = NULL;
	}
}

long FAR PASCAL RotinaJanela(HWND Janela, UINT Mensagem, WPARAM wParam, LPARAM lParam) {
	switch (Mensagem) {
	case WM_KEYDOWN:
		switch (wParam) {
			case VK_ESCAPE:
			case VK_F12:
			PostMessage(Janela, WM_CLOSE, 0, 0);
			break;
		}
		case WM_DESTROY:
			Saida();
			Janela = NULL;
			PostQuitMessage(0);
			break;
		case WM_MOUSEMOVE:
			CursorX = LOWORD(lParam);
			CursorY = HIWORD(lParam);
			BotaoE = wParam & MK_LBUTTON;
			BotaoD = wParam & MK_RBUTTON;
			break;
	}	
	return DefWindowProc(Janela, Mensagem, wParam, lParam);
}

int InicializaJanelas(HINSTANCE Instancia) {
	WNDCLASS Classe;	// Classe da janela
	DDSURFACEDESC DescricaoSuperficie;
	DDSCAPS SuperficieCaps;
	HRESULT Erro;
	
	// Registra classe
	Classe.style = CS_HREDRAW | CS_VREDRAW;
	Classe.lpfnWndProc = RotinaJanela;
	Classe.cbClsExtra = 0;
	Classe.cbWndExtra = 0;
	Classe.hInstance = Instancia;
	Classe.hIcon = LoadIcon(Instancia, IDI_APPLICATION);
	Classe.hCursor = LoadCursor(NULL, IDC_ARROW);
	Classe.hbrBackground = NULL;
	Classe.lpszMenuName = "NomeMenu";
	Classe.lpszClassName = "NomeClasse";
	RegisterClass(&Classe);

	// Cria janela
	Janela = CreateWindowEx(
		WS_EX_TOPMOST,
		"NomeClasse",
		"TituloJanela",
		WS_POPUP,
		0, 0,
		GetSystemMetrics(SM_CXSCREEN),
		GetSystemMetrics(SM_CYSCREEN),
		NULL,
		NULL,
		Instancia,
		NULL);
	
	// Mostra Janela
	ShowWindow(Janela, SW_MAXIMIZE);
	UpdateWindow(Janela);

	// Cria DirectDraw e coloca em modo exclusivo
	Erro = DirectDrawCreate(NULL, &DirectDraw, NULL);
	if (Erro == DD_OK) {
		Erro = DirectDraw->SetCooperativeLevel(Janela, DDSCL_EXCLUSIVE | DDSCL_FULLSCREEN);
		if (Erro == DD_OK) {
			Erro = DirectDraw->SetDisplayMode(640,480,8);
			if (Erro == DD_OK) {
				// Cria Superficie Primária
				DescricaoSuperficie.dwSize = sizeof(DescricaoSuperficie);
				DescricaoSuperficie.dwFlags = 
					DDSD_CAPS | 
					DDSD_BACKBUFFERCOUNT;
				DescricaoSuperficie.ddsCaps.dwCaps = 
					DDSCAPS_PRIMARYSURFACE | 
					DDSCAPS_FLIP | 
					DDSCAPS_COMPLEX;
				DescricaoSuperficie.dwBackBufferCount = 1;
				Erro = DirectDraw->CreateSurface(&DescricaoSuperficie, &SuperficiePrimaria, NULL);
				if (Erro == DD_OK) {
					// Cria Superfície Secundária
					SuperficieCaps.dwCaps = DDSCAPS_BACKBUFFER;
					Erro = SuperficiePrimaria->GetAttachedSurface(&SuperficieCaps, &SuperficieSecundaria);
					if (Erro == DD_OK) return TRUE;
				}
			}
		}
	}
	Saida();
	MessageBox(Janela, "Erro na inicialização do DirectDraw", "Teste", MB_OK | MB_ICONERROR);
	DestroyWindow(Janela);
	return FALSE;
}
	
int PASCAL WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nShowCmd) {
	MSG Mensagem;
	
	lpCmdLine = lpCmdLine; // Não enche o saco c/ warning
	hPrevInstance = hPrevInstance;
	ShowCursor(FALSE);
	if (InicializaJanelas(hInstance))  {
//		Esconde();
		CarregaRecursos();
		while (1) {
			if (PeekMessage(&Mensagem, NULL, 0, 0, PM_NOREMOVE)) {
				if (GetMessage(&Mensagem, NULL, 0, 0)) {
					TranslateMessage(&Mensagem);
					DispatchMessage(&Mensagem);
				} else {
					DescarregaRecursos();
					ShowCursor(TRUE);
					Saida();
					return Mensagem.wParam;
				}
			} else 
				ProcessaFrame();
		}
	}
	ShowCursor(TRUE);
	
	Saida();
	if (Janela) ShowWindow(Janela, SW_HIDE);
	MessageBox(NULL, "Erro", "Erro", MB_OK);
	return 0;
}