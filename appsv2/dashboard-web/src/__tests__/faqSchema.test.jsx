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

const WITH_FAQ = ['plausible-alternative', 'matomo-alternative', 'umami-alternative'];

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

    // Google requires the marked-up answer to be visible on the page; emitting
    // FAQPage for a post with no FAQ section would be invalid markup.
    it('omits FAQPage for posts without an FAQ section', () => {
        mountPost('bounce-rate-explained');
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
