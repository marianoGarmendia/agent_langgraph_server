# agent_lacalle

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.30. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.


### Poryecto de agente de voz

> *Descargar y agregar al path para servidor propio*

https://ffmpeg.org/download.html
Descargar ffmpeg para procesar archivos de audio


> *Descargar y agregar al path para servidor propio*

instalar SOX para que 'mic' funcione
Download: https://sourceforge.net/projects/sox/files/latest/download
Intalarlo al PATH

Una vez que graba lo guarda en un archivo "userInput.wav" , para poder escucharlo (porque con las configuraciones actuales no permite) podemos hacer:
sox userInput.wav output.wav > esto lo hace mas reproducible cambiandole las cabeceras

- Instalar whipser , hay diferentes modelos, apara local utilizo "small" pero produccion utilizar "large"
- comando npx whisper-node download small , eso te lleva a un meno donde elegir elmodelo, lo hace a traves de la libreria de whisper-node en linea , que ya tenemos instalada
 - Instalar cmake (descarga https://cmake.org/download/) > cmake-4.0.0-rc5-windows-x86_64.msi
 - Whisper depende de make apra ser instalado
 - debo instalar compiladores de c++ > Andá a https://visualstudio.microsoft.com/es/visual-cpp-build-tools/ > Durante la instalación, marcá:

✔️ "Desarrollo para escritorio con C++"



desde la consola: "x64 Native Tools Command Prompt for VS 2022"
- En esta consola pararme en apralelo al proyecto y hacer > git clone https://github.com/ggerganov/whisper.cpp.git
- Descargar el modelo de "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin" y guardarlo en "C:\Users\usuario\lacalle_ai\whisper.cpp\models\" (esto descarga ggml-small.bin) > en produccion descargar el large !!!
- ingresar en > cd whisper.cpp
                ejecutar: cmake -B build .
                ejecutar: cmake --build build --config Release

- Esto guarda un ejecutable en: C:\Users\usuario\lacalle_ai\whisper.cpp\build\bin\Release\whisper-cli.exe (ver todo el codigo de rutas y conversion de audio format con sox en src/processing-voices/audio-transcription.ts)

------------------


navegar hasta "cd node_modules\whisper-node\lib\whisper.cpp" > anteriormente tenemos que estar parados dentro del directorio del proyecto
- Una vez dentro ejecutar > cmake -B build . > cmake --build build --config Release


