#!/bin/bash
curl -fsSL https://raw.githubusercontent.com/NoeCB/iTutor/features/mejoras-finales/banana-server/itutor_api.py -o /home/ubuntu/itutor_api.py
chown ubuntu:ubuntu /home/ubuntu/itutor_api.py
chmod +x /home/ubuntu/itutor_api.py

cat << 'EOF' > /etc/systemd/system/itutor.service
[Unit]
Description=iTUTOR Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/python3 /home/ubuntu/itutor_api.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable itutor
systemctl start itutor
