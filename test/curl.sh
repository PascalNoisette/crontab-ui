#!/usr/bin/env bash

curl -v -H "Content-Type: application/json" --data @sample.git.data 'http://127.0.0.1:8000/hook/?id=P1qZY1cI8zPU4C7r'

curl -v -F 'data[0]=@README.md' -F 'data[1]=@Makefile' 'http://127.0.0.1:8000/hook/?id=P1qZY1cI8zPU4C7r'