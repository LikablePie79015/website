---
title: "线性代数笔记：矩阵与特征值"
date: "2026-08-28"
tags: ["数学", "线性代数"]
---

# 矩阵与特征值

特征值与特征向量是线性代数中极为重要的概念，它们在物理、工程与数据科学中有广泛应用。

## 定义

设 $A$ 是一个 $n \times n$ 的方阵，若存在非零向量 $\mathbf{v}$ 和标量 $\lambda$ 使得：

$$A\mathbf{v} = \lambda \mathbf{v}$$

则称 $\lambda$ 为 **特征值**，$\mathbf{v}$ 为对应的 **特征向量**。

## 特征方程

特征值可以通过求解特征方程得到：

$$
\det(A - \lambda I) = 0
$$

## 一个例子

考虑矩阵：

$$
A = \begin{pmatrix} 2 & 1 \\ 1 & 2 \end{pmatrix}
$$

其特征方程为：

$$
\det
\begin{pmatrix}
2 - \lambda & 1 \\
1 & 2 - \lambda
\end{pmatrix}
= (2 - \lambda)^2 - 1 = 0
$$

解得特征值 $\lambda_1 = 3$，$\lambda_2 = 1$。

对应的特征向量分别为：

$$
\mathbf{v}_1 = \begin{pmatrix} 1 \\ 1 \end{pmatrix}, \quad
\mathbf{v}_2 = \begin{pmatrix} 1 \\ -1 \end{pmatrix}
$$

## 对角化

如果矩阵 $A$ 有 $n$ 个线性无关的特征向量，则可以对角化：

$$
A = P D P^{-1}
$$

其中 $D$ 是对角矩阵，对角线上的元素即为特征值。

> **记忆技巧**：特征值告诉我们变换"拉伸"的方向与幅度，特征向量则指示了这些方向。
