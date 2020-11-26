import {ReadmeTemplate} from '../../src';
import path from 'path';

const expectRenderSameAsFile = (template: ReadmeTemplate, file: string) => {
    expect((template.render() || '').trimRight()).toEqual(require('fs').readFileSync(path.resolve(`${__dirname}/../../__fixtures__/templates/readmes/${file}`), 'utf8').trim());
};

describe('render', () => {
    it('no fragments', () => {
        expectRenderSameAsFile(new ReadmeTemplate({readme: true}), 'no-fragments.md');
    })
    it('one fragment', () => {
        expectRenderSameAsFile(new ReadmeTemplate({readme: true}).addInlineFragment("# this is a title\n\nthis is a content"), 'one-fragment.md');
    })
    it('one fragment', () => {
        expectRenderSameAsFile(
            new ReadmeTemplate({readme: true})
                .addInlineFragment(
                    "# title 1\n\ncontent 1\non multi-line"
                )
                .addInlineFragment(
                    "# title 2\n\ncontent 2"
                )
            ,
            'two-fragments.md'
        );
    })
})