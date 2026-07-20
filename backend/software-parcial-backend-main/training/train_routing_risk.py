#!/usr/bin/env python3
"""Entrena el MLP de riesgo con eventos SLA históricos exportados del workflow_db.

Cada trámite aporta una observación al crearse (sin demora) y otra cuando existe
el evento persistido de escalamiento SLA (demora confirmada). No usa aleatoriedad.
"""
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "routing-risk-training.csv"
MODEL = ROOT.parent / "src/main/resources/models/routing-risk-mlp-v1.json"
METRICS = ROOT / "metrics.json"


def sigmoid(value):
    value = max(-40.0, min(40.0, value))
    return 1.0 / (1.0 + math.exp(-value))


def forward(x, w1, b1, w2, b2):
    hidden = [max(0.0, b1[h] + sum(w1[h][i] * x[i] for i in range(3))) for h in range(4)]
    return hidden, sigmoid(b2 + sum(w2[h] * hidden[h] for h in range(4)))


with DATA.open(newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))
samples = [([float(r["priority_norm"]), float(r["sla_factor"]), float(r["history_factor"])], float(r["label"])) for r in rows]
validation_indexes = {0, 1, 10, 11}
train = [sample for index, sample in enumerate(samples) if index not in validation_indexes]
validation = [sample for index, sample in enumerate(samples) if index in validation_indexes]

# Inicialización determinista y simétrica rota explícitamente; no hay random.
w1 = [[0.08, -0.05, 0.03], [-0.04, 0.09, 0.02], [0.05, 0.04, -0.07], [-0.02, 0.06, 0.08]]
b1 = [0.01, 0.02, 0.03, 0.04]
w2 = [0.05, -0.04, 0.06, 0.03]
b2 = 0.0
learning_rate = 0.08

for _epoch in range(2500):
    for x, label in train:
        hidden, prediction = forward(x, w1, b1, w2, b2)
        output_delta = prediction - label
        old_w2 = w2[:]
        for h in range(4):
            w2[h] -= learning_rate * output_delta * hidden[h]
        b2 -= learning_rate * output_delta
        for h in range(4):
            relu_gradient = 1.0 if hidden[h] > 0 else 0.0
            hidden_delta = output_delta * old_w2[h] * relu_gradient
            for i in range(3):
                w1[h][i] -= learning_rate * hidden_delta * x[i]
            b1[h] -= learning_rate * hidden_delta


def evaluate(dataset):
    losses, correct = [], 0
    tp = tn = fp = fn = 0
    outputs = []
    for x, label in dataset:
        _, prediction = forward(x, w1, b1, w2, b2)
        outputs.append(prediction)
        losses.append(-(label * math.log(max(prediction, 1e-9)) + (1-label) * math.log(max(1-prediction, 1e-9))))
        predicted = prediction >= 0.5
        actual = bool(label)
        correct += int(predicted == actual)
        tp += int(predicted and actual)
        tn += int(not predicted and not actual)
        fp += int(predicted and not actual)
        fn += int(not predicted and actual)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "samples": len(dataset),
        "classDistribution": {"negative": sum(1 for _, y in dataset if y == 0), "positive": sum(1 for _, y in dataset if y == 1)},
        "accuracy": correct / len(dataset),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "confusionMatrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "binaryCrossEntropy": sum(losses) / len(losses),
        "outputs": outputs,
    }


model = {
    "name": "routing-risk-mlp",
    "version": "1.1.0",
    "experimental": True,
    "warning": "Modelo experimental con datos limitados",
    "featureOrder": ["priority_norm", "sla_factor", "history_factor"],
    "inputSize": 3,
    "hiddenSize": 4,
    "hiddenWeights": w1,
    "hiddenBias": b1,
    "outputWeights": w2,
    "outputBias": b2,
}
MODEL.write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
metrics = {
    "dataset": DATA.name,
    "source": "Eventos creación/escalamiento SLA persistidos de WF-2026-001..007",
    "features": ["priority_norm", "sla_factor", "history_factor"],
    "featureSpecification": {
        "priority_norm": "Categoría persistida: BAJA=0.1, MEDIA=0.4, ALTA=0.7, URGENTE=1.0; ausente=BAJA",
        "sla_factor": "Minutos restantes: vencido=1.0, <=60=0.8, <=240=0.45, >240 o sin fecha=0.1",
        "history_factor": "min(1.0, cantidad_eventos_persistidos/10); sin historial=0.0"
    },
    "label": "1 si existe escalamiento SLA; 0 en observación de creación",
    "architecture": "3-ReLU(4)-Sigmoid(1)",
    "epochs": 2500,
    "learningRate": learning_rate,
    "optimizer": "Descenso de gradiente estocástico, BCE con derivada Sigmoid+BCE",
    "reproducibility": "Inicialización determinista explícita; no usa números aleatorios",
    "warning": "Modelo experimental con datos limitados; las métricas no demuestran generalización productiva",
    "train": evaluate(train),
    "validation": evaluate(validation),
}
METRICS.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metrics, indent=2))
