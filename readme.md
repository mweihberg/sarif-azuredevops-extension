# SARIF SAST Scans Tab

Fork von [https://github.com/microsoft/sarif-azuredevops-extension](https://github.com/microsoft/sarif-azuredevops-extension ) aufgrund der Problematik, dass bei mehreren Scannern, welche SARIF Logs im CodeAnalysisLogs Artifact publishen, dann die Dateinamen der sarif-Dateien nicht mehr angezeigt werden.

Dies ist hier in einem Issue beschrieben:
[https://github.com/microsoft/sarif-azuredevops-extension/issues/45](https://github.com/microsoft/sarif-azuredevops-extension/issues/450)

## Deployment
Aktuell gibt es keine Pipeline die das Projekt baut. Daher sind folgende manuellen Schritte notwendig:

1. npm installieren
2. pwsh im Projektverzeichnis als Local Admin öffnen
3. ` npm config set proxy http://http-proxy.niedersachsen.de:8080`
4. `npm config set https-proxy http://http-proxy.niedersachsen.de:8080`
5. TFS Extension Framework mit `npm install -g tfx-cli` installieren
6. `npx webpack` ausführen - dist Verzeichnis wird angelegt
7. Version in `vss-extension.prod.json` erhöhen
8. Version publishen mit `npx tfx extension create --output-path: vsix --manifests vss-extension.json vss-extension.prod.json`


Anschließend kann das fertige `vsix` Paket auf den Azure DevOps Server [hochgeladen](https://intra.devops.it.niedersachsen.de/tfs/_gallery/manage) werden. Dazu muss man Collection Admin sein. Ist die Extension schon installiert erfolgt das Update über das Menü an dem jeweiligen Eintrag.
