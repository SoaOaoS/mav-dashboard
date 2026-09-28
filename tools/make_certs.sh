#!/usr/bin/env bash
# Génère une CA locale + un certificat serveur pour le dashboard Mav.
# Ajuste SAN si l'IP ou le hostname changent.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$DIR"
cd "$DIR"

SAN_IP="${MAV_SAN_IP:-192.168.1.32}"
SAN_DNS="${MAV_SAN_DNS:-mav.local,opc.local}"

# CA
openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
  -keyout ca.key -out ca.crt -subj "/CN=Mav Local CA/O=Mav"

# Certificat serveur
openssl req -newkey rsa:2048 -sha256 -nodes \
  -keyout server.key -out server.csr -subj "/CN=${SAN_IP}/O=Mav"

cat > san.cnf <<EOF
subjectAltName=IP:${SAN_IP},DNS:${SAN_DNS}
extendedKeyUsage=serverAuth
EOF

openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 3650 -sha256 -extfile san.cnf

chmod 600 ./*.key
echo "Certificats générés dans $DIR"
openssl verify -CAfile ca.crt server.crt
