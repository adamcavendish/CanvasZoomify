from PIL import Image
import os
import sys
import json

info_message = \
'''CanvasZoomifySlicer usage: CanvasZoomifySlicer [RawImagePath] [BaseDir] [Prefix] [Levels] [SliceRows] [SliceCols]

example: CanvasZoomifySlicer 'MyMapRaw.jpg' 'images/MyMap/' 'Map' 4 4 2
    it will create a series of levels of images in format of
        images/MyMap/[level]/Map-[level]-[row]-[col].jpg

    like:
        images/MyMap/1/Map-1-0-0.jpg,
        images/MyMap/1/Map-1-0-1.jpg,
        ...,
        images/MyMap/1/Map-1-1-0.jpg,
        images/MyMap/1/Map-1-1-1.jpg,
        ...,
        images/MyMap/2/Map-2-0-0.jpg,
        ...
'''

def image_scale(image, save_path, scale, quality):
    (width, height) = image.size
    (scaledWidth, scaledHeight) = tuple(int(i * scale) for i in (width, height))
    scaledImage = image.resize((scaledWidth, scaledHeight), Image.BICUBIC)
    scaledImage.save(save_path, quality=quality)

def image_slice(image, save_dir, save_image_prefix, save_image_type, row_num, col_num):
    (im_width, im_height) = image.size

    im_height_step = im_height / row_num
    im_width_step = im_width / col_num
    for row in range(row_num):
        for col in range(col_num):
            crop_box = (col * im_width_step, row * im_height_step,
                        (col+1) * im_width_step, (row+1) * im_height_step)
            im_slice = image.crop(crop_box)
            slice_name = '{}-{}-{}.{}'.format(save_image_prefix,
                                              row, col,
                                              save_image_type)
            save_path = os.path.join(save_dir, slice_name)
            im_slice.save(save_path)

if __name__ == '__main__':
    if len(sys.argv) != 7:
        print(info_message)
        sys.exit(1)

    raw_image_path = sys.argv[1]
    base_dir_path = sys.argv[2]
    prefix = sys.argv[3]
    levels = int(sys.argv[4])
    slice_rows = int(sys.argv[5])
    slice_cols = int(sys.argv[6])

    level_values = [2**i for i in range(levels)]
    image_type = 'jpg'
    image_quality = 70
    tile_width = None
    tile_height = None

    base_dir = os.path.abspath(base_dir_path)
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)

    raw_image = Image.open(raw_image_path)
    tile_width = raw_image.size[0] / level_values[-1] / slice_cols
    tile_height = raw_image.size[1] / level_values[-1] / slice_rows
    for levelIndex in range(levels):
        level = level_values[levelIndex]
        level_dir = os.path.join(base_dir, str(level))
        if not os.path.exists(level_dir):
            os.mkdir(level_dir)

        scaled_image_path = os.path.join(base_dir, '{}-{}.{}'.format(prefix, level, image_type))
        scale = 1.0/level_values[levels - levelIndex - 1]
        image_scale(raw_image, scaled_image_path, scale, image_quality)

        scaled_image = Image.open(scaled_image_path)
        image_slice(scaled_image, level_dir,
                    '{}-{}'.format(prefix, str(level)),
                    image_type, slice_rows*level, slice_cols*level)
        scaled_image.close()
    raw_image.close()

    # Prepare the output values
    output =                                                       \
      '{\n'                                                        \
    + '    isDebug: false,\n'                                      \
    + '    levelValues: {},\n'.format(json.dumps(level_values))    \
    + '    rowsPerLevel: {},\n'.format(json.dumps(slice_rows))     \
    + '    colsPerLevel: {},\n'.format(json.dumps(slice_cols))     \
    + '    tileWidth: {},\n'.format(json.dumps(tile_width))        \
    + '    tileHeight: {},\n'.format(json.dumps(tile_height))      \
    + '    tilesBasePath: {},\n'.format(json.dumps(base_dir_path)) \
    + '    tileNamePrefix: {},\n'.format(json.dumps(prefix))       \
    + '    tileImageType: {},\n'.format(json.dumps(image_type))    \
    + '    tiles: null,\n'                                         \
    + '}'
    print(output)

