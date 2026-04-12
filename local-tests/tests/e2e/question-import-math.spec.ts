/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import {
  getPastedContentWithMathNodeHtml,
  getPastedMathNodeHtml,
} from "../../../lib/question-import/math";

test.describe("Question import math paste helpers @desktop", () => {
  test("keeps mixed pasted text while converting each delimited latex fragment", () => {
    const copiedQuestion = String.raw`-VAE 类似，只是使用了K
$$
- E_{z \sim q ( z \mid x )} [ \operatorname{l o g} ( p ( x \mid z ) ) ]+K L ( q ( z \mid x ) \| p ( z ) )
$$
其中 $$z$$ 利用 Gumbel-Softmax从 $$( z \sim q ( z | x ) \textsc{} \mathfrak{v}$$ 中抽样得到， $$p ( z )$$ 是个等概率的多项式分布`;

    const html = getPastedContentWithMathNodeHtml(copiedQuestion);

    expect(html).not.toBeNull();
    expect(html).toContain("-VAE 类似，只是使用了K");
    expect(html).toContain("其中 ");
    expect(html).not.toContain('data-latex="-VAE');
    expect((html?.match(/data-type="math"/g) || []).length).toBe(4);
  });

  test("converts inline single-dollar latex inside pasted text", () => {
    const html = getPastedContentWithMathNodeHtml(
      "The simplified form is $x^2 + 2x + 1$ for this step.",
    );

    expect(html).not.toBeNull();
    expect(html).toContain("The simplified form is ");
    expect((html?.match(/data-type="math"/g) || []).length).toBe(1);
    expect(html).toContain('data-latex="x^2 + 2x + 1"');
  });

  test("still converts standalone latex without delimiters into a single math node", () => {
    const html = getPastedMathNodeHtml(String.raw`\frac{a+b}{c}-x_1`);

    expect(html).not.toBeNull();
    expect(html).toContain('data-type="math"');
    expect(html).toContain('data-display-mode="false"');
    expect(html).toContain('data-latex="\\frac{a + b}{c}-x_1"');
  });
});
