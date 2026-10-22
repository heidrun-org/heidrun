///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ParallaxRules — where each parallax layer is
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The rules of the parallax layers. Each layer repeats a picture of a fixed width, and moves at a part of the speed
 * of the ground, so a far layer moves slowly and a near layer moves fast.
 */
export class ParallaxRules {
	/**
	 * Gives how far a layer moved to the left, inside one picture of the layer.
	 * @param distance The distance that the ground went through, in units.
	 * @param layerSpeed The speed of the layer, as a part of the speed of the ground.
	 * @param pictureWidth The width of the repeated picture of the layer, in units.
	 * @returns A number from 0 up to, but not including, the width of the picture.
	 */
	static layerOffset(distance: number, layerSpeed: number, pictureWidth: number): number {
		const offset = (((distance * layerSpeed) % pictureWidth) + pictureWidth) % pictureWidth;
		return offset;
	}
}
