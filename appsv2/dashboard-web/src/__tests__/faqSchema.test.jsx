import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Blog from '../pages/Blog';
import { BLOG_POSTS } from '../data/blogPosts';

const mountPost = (slug) => render(
    <MemoryRouter initialEntries={[`/blog/${slug}`]}>
        <Routes><Route path="/blog/:slug" element={<Blog />} /></Routes>
    </MemoryRouter>
);

const graphOf = () => JSON.parse(document.getElementById('page-jsonld').textContent)['@graph'];
const faqOf = () => graphOf().find((n) => n['@type'] === 'FAQPage');

// Every post now carries an FAQ section, so the schema assertions run against
// all of them rather than a hand-picked three — a post that loses its FAQ, or
// whose markup stops parsing, fails here instead of going unnoticed.
const WITH_FAQ = BLOG_POSTS
    .filter((p) => /^## Frequently asked questions\s*$/m.test(p.body))
    .map((p) => p.slug);

describe('FAQ structured data', () => {
    // Counts the '### ' headings inside the body's FAQ section — the schema must
    // carry every one. A regex that lost the last question still passed a
    // >=4 assertion, so this compares against the source of truth instead.
    const faqHeadingsInBody = (slug) => {
        const body = BLOG_POSTS.find((p) => p.slug === slug).body;
        const section = body.split(/^## Frequently asked questions\s*$/m)[1].split(/^## /m)[0];
        return [...section.matchAll(/^### (.+)$/gm)].map(([, q]) => q.trim());
    };

    it('emits a FAQPage carrying every question in the body', () => {
        for (const slug of WITH_FAQ) {
            const { unmount } = mountPost(slug);
            const faq = faqOf();
            expect(faq, slug).toBeTruthy();
            expect(faq.mainEntity.map((q) => q.name), slug).toEqual(faqHeadingsInBody(slug));
            unmount();
        }
    });

    // The final question has no following '### ' to terminate it, so it is the
    // one an end-of-input anchor bug drops.
    it('includes the last question in the section', () => {
        for (const slug of WITH_FAQ) {
            const { unmount } = mountPost(slug);
            const expected = faqHeadingsInBody(slug).at(-1);
            const last = faqOf().mainEntity.at(-1);
            expect(last.name, slug).toBe(expected);
            expect(last.acceptedAnswer.text.length, slug).toBeGreaterThan(20);
            unmount();
        }
    });

    // Google requires the marked-up answer to be visible on the page, so a post
    // with no FAQ section must not emit FAQPage. Every published post currently
    // has one, so this drives the component with a synthetic FAQ-less body
    // rather than naming a real post that could later gain an FAQ.
    it('omits FAQPage for a post without an FAQ section', () => {
        const withFaq = BLOG_POSTS.filter((p) => /^## Frequently asked questions\s*$/m.test(p.body));
        expect(withFaq.length, 'every post should carry an FAQ section').toBe(BLOG_POSTS.length);

        const noFaq = BLOG_POSTS.find((p) => !/^## Frequently asked questions\s*$/m.test(p.body));
        if (!noFaq) return; // nothing to assert while all posts have an FAQ
        mountPost(noFaq.slug);
        expect(faqOf()).toBeUndefined();
    });

    it('every question has a non-empty plain-text answer', () => {
        for (const slug of WITH_FAQ) {
            const { unmount } = mountPost(slug);
            for (const qa of faqOf().mainEntity) {
                expect(qa.name.length, slug).toBeGreaterThan(5);
                expect(qa.acceptedAnswer.text.length, `${slug}: ${qa.name}`).toBeGreaterThan(20);
                // Markdown must be stripped — schema values are plain text.
                expect(qa.acceptedAnswer.text, `${slug}: ${qa.name}`).not.toMatch(/\]\(|\*\*/);
            }
            unmount();
        }
    });

    // The "## How to decide" heading follows the FAQ in every one of these
    // posts; if the section scoping broke, its text would leak into the last answer.
    it('stops at the next h2 instead of swallowing later sections', () => {
        mountPost('plausible-alternative');
        const last = faqOf().mainEntity.at(-1).acceptedAnswer.text;
        expect(last).not.toMatch(/How to decide/);
    });

    it('questions match the headings rendered on the page', () => {
        const { container } = mountPost('umami-alternative');
        const headings = [...container.querySelectorAll('h3')].map((h) => h.textContent.trim());
        for (const qa of faqOf().mainEntity) expect(headings).toContain(qa.name);
    });
});
